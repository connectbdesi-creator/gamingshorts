// Job 3 of the matrix pipeline (see .github/workflows/ingest.yml): merges
// every classify-shard.ts matrix job's partial results back together,
// clusters the FULL set (a story split across two shards can only be
// caught once they're back in one place), builds the final cards, and
// writes/commits data/cards.json same as the old single-job run.ts did.
import fs from "node:fs";
import path from "node:path";
import { clusterAndBuildCards } from "./lib/cluster";
import { syncCommentCounts } from "./lib/comment-counts";
import { fetchGameInfo } from "./game-info";
import { sendPushForNewCards } from "./push";
import { MAX_CARDS } from "./lib/constants";
import type { Draft, MergedClusterLogEntry, ProviderBreakdown, SkippedLogEntry } from "./lib/types";
import {
  CARDS_PATH,
  DATA_DIR,
  DATA_TMP_DIR,
  GAMES_PATH,
  LOG_PATH,
  META_PATH,
  SEEN_PATH,
  readJson,
  writeJson,
} from "./lib/io";
import type { Card } from "@/types/card";
import type { GameInfo } from "@/types/game-info";

interface CandidatesFile {
  baseSeen: string[];
  candidates: unknown[];
  timing: { rssFetchMs: number; sourceErrors: number };
}

interface ShardResultFile {
  shardIndex: number;
  candidateCount: number;
  drafts: Draft[];
  skippedLog: SkippedLogEntry[];
  processedItemIds: string[];
  providerBreakdown: ProviderBreakdown;
  timingMs: number;
}

function readShardResults(): ShardResultFile[] {
  if (!fs.existsSync(DATA_TMP_DIR)) return [];
  return fs
    .readdirSync(DATA_TMP_DIR)
    .filter((f) => /^shard-\d+\.json$/.test(f))
    .map((f) => readJson<ShardResultFile>(path.join(DATA_TMP_DIR, f), {
      shardIndex: -1,
      candidateCount: 0,
      drafts: [],
      skippedLog: [],
      processedItemIds: [],
      providerBreakdown: { ollama: 0, "rule-based": 0 },
      timingMs: 0,
    }))
    .sort((a, b) => a.shardIndex - b.shardIndex);
}

/**
 * Fetches RAWG metadata (see game-info.ts) for every game in `cards` that
 * doesn't already have an entry in data/games.json — existing entries are
 * never re-fetched, which keeps this well within RAWG's free-tier request
 * budget. No-ops entirely if RAWG_API_KEY isn't set.
 */
async function fetchNewGameInfo(cards: Card[]): Promise<number> {
  const games = readJson<GameInfo[]>(GAMES_PATH, []);
  const knownSlugs = new Set(games.map((g) => g.slug));

  const newGames = new Map<string, string>();
  for (const card of cards) {
    if (card.game && card.game_label && !knownSlugs.has(card.game)) {
      newGames.set(card.game, card.game_label);
    }
  }
  if (newGames.size === 0) return 0;

  for (const [slug, label] of newGames) {
    console.log(`- Fetching game info for "${label}"`);
    const info = await fetchGameInfo(slug, label);
    if (info) games.push(info);
  }

  writeJson(GAMES_PATH, games);
  return newGames.size;
}

async function main() {
  const startedAt = Date.now();
  const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const candidatesFile = readJson<CandidatesFile>(path.join(DATA_TMP_DIR, "candidates.json"), {
    baseSeen: [],
    candidates: [],
    timing: { rssFetchMs: 0, sourceErrors: 0 },
  });
  const shardResults = readShardResults();

  const drafts: Draft[] = [];
  const skippedLog: SkippedLogEntry[] = [];
  const mergedClustersLog: MergedClusterLogEntry[] = [];
  const providerBreakdown: ProviderBreakdown = { ollama: 0, "rule-based": 0 };
  const seen = new Set<string>(candidatesFile.baseSeen);
  const shardTimings: { shardIndex: number; candidateCount: number; timingMs: number }[] = [];

  for (const shard of shardResults) {
    drafts.push(...shard.drafts);
    skippedLog.push(...shard.skippedLog);
    for (const id of shard.processedItemIds) seen.add(id);
    providerBreakdown.ollama += shard.providerBreakdown.ollama;
    providerBreakdown["rule-based"] += shard.providerBreakdown["rule-based"];
    shardTimings.push({ shardIndex: shard.shardIndex, candidateCount: shard.candidateCount, timingMs: shard.timingMs });
  }

  console.log(
    `Merged ${shardResults.length} shard result(s): ${drafts.length} draft(s), ${skippedLog.length} skipped.\n`
  );

  const existingCards = readJson<Card[]>(CARDS_PATH, []);
  const { newCards, mergedClustersLog: clusterLog, timingMs: clusteringMs } = await clusterAndBuildCards(
    drafts,
    existingCards
  );
  mergedClustersLog.push(...clusterLog);

  // Defensive de-dup by id on top of the seen-set check above — belt and
  // suspenders against ever re-adding the same article twice (e.g. after a
  // seen.json reset), since a duplicate id breaks React's list
  // reconciliation (duplicate keys) wherever cards render. Keeps whichever
  // copy sorts first (newCards before existingCards, i.e. the newest).
  const seenIds = new Set<string>();
  const merged = [...newCards, ...existingCards]
    .filter((card) => {
      if (seenIds.has(card.id)) return false;
      seenIds.add(card.id);
      return true;
    })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    .slice(0, MAX_CARDS);

  const commentSyncStartedAt = Date.now();
  const { updated: commentCountsUpdated } = await syncCommentCounts(merged);
  const commentSyncMs = Date.now() - commentSyncStartedAt;
  if (commentCountsUpdated > 0) {
    console.log(`- Synced comment counts: ${commentCountsUpdated} card(s) updated from GitHub Discussions`);
  }

  writeJson(CARDS_PATH, merged);
  writeJson(SEEN_PATH, Array.from(seen));
  // Written every run regardless of whether new cards were found — this is
  // "when did the cron last check", not "when did it last find something",
  // which is what the header's last-refresh indicator actually needs.
  writeJson(META_PATH, { lastRunAt: new Date().toISOString() });

  const gameInfoStartedAt = Date.now();
  await fetchNewGameInfo(merged);
  const gameInfoMs = Date.now() - gameInfoStartedAt;

  if (newCards.length > 0) {
    await sendPushForNewCards(newCards);
  }

  const totalMs = Date.now() - startedAt;
  const totalInferenceMs = shardTimings.reduce((sum, s) => sum + s.timingMs, 0);
  writeJson(LOG_PATH, {
    generatedAt: new Date().toISOString(),
    model,
    providerBreakdown,
    candidatesConsidered: candidatesFile.candidates.length,
    newCardsPublished: newCards.length,
    skipped: skippedLog,
    mergedClusters: mergedClustersLog,
    timing: {
      rssFetchMs: candidatesFile.timing.rssFetchMs,
      shardCount: shardResults.length,
      shardTimings,
      // Wall-clock time actually spent classifying is ~max(shardTimings),
      // not the sum — the shards ran in parallel. totalInferenceMs (the
      // sum) is reported too since it's the more useful number for
      // estimating cost/throughput if the shard count ever changes.
      classifyWallClockMs: shardTimings.length > 0 ? Math.max(...shardTimings.map((s) => s.timingMs)) : 0,
      totalInferenceMs,
      clusteringMs,
      commentSyncMs,
      gameInfoMs,
      mergeJobTotalMs: totalMs,
    },
    commentCountsUpdated,
  });

  console.log(
    `\nDone in ${(totalMs / 1000).toFixed(1)}s (this job). ${newCards.length} new card(s) added (${skippedLog.length} skipped, ${mergedClustersLog.length} merged), ${merged.length} total in data/cards.json.`
  );
  console.log(`Provider usage — ollama: ${providerBreakdown.ollama}, rule-based: ${providerBreakdown["rule-based"]}`);
}

main().catch((err) => {
  console.error("merge-and-publish failed:", err);
  process.exit(1);
});
