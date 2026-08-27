// Local single-process entry point (`pnpm ingest`) — runs the same fetch
// -> classify -> cluster pipeline as the GitHub Actions matrix workflow
// (fetch-candidates.ts -> classify-shard.ts x N -> merge-and-publish.ts),
// just sequentially in one process instead of split across parallel CI
// jobs. Shares every bit of actual logic with that pipeline via lib/ —
// nothing here is reimplemented, just composed differently.
import fs from "node:fs";
import { gatherCandidates } from "./lib/gather";
import { classifyCandidates } from "./lib/classify";
import { clusterAndBuildCards } from "./lib/cluster";
import { syncCommentCounts } from "./lib/comment-counts";
import { DEFAULT_MAX_NEW_PER_SOURCE, FORCE_REFRESH_MAX_NEW_PER_SOURCE, MAX_CARDS } from "./lib/constants";
import { updateEventDetection, type EventDetectionState } from "./lib/event-detection";
import { fetchGameInfo } from "./game-info";
import { sendPushForNewCards } from "./push";
import {
  CARDS_PATH,
  DATA_DIR,
  GAMES_PATH,
  LOG_PATH,
  META_PATH,
  SEEN_PATH,
  readJson,
  writeJson,
} from "./lib/io";
import type { Card } from "@/types/card";
import type { GameInfo } from "@/types/game-info";

const FORCE_REFRESH = process.env.FORCE_REFRESH === "true";

async function fetchNewGameInfo(cards: Card[]) {
  const games = readJson<GameInfo[]>(GAMES_PATH, []);
  const knownSlugs = new Set(games.map((g) => g.slug));

  const newGames = new Map<string, string>();
  for (const card of cards) {
    if (card.game && card.game_label && !knownSlugs.has(card.game)) {
      newGames.set(card.game, card.game_label);
    }
  }
  if (newGames.size === 0) return;

  for (const [slug, label] of newGames) {
    console.log(`- Fetching game info for "${label}"`);
    const info = await fetchGameInfo(slug, label);
    if (info) games.push(info);
  }

  writeJson(GAMES_PATH, games);
}

async function run() {
  const startedAt = Date.now();
  const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
  console.log(`Model provider: Ollama (${model}), rule-based keyword classification as fallback\n`);

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const maxPerSource = FORCE_REFRESH ? FORCE_REFRESH_MAX_NEW_PER_SOURCE : DEFAULT_MAX_NEW_PER_SOURCE;
  const baseSeen = FORCE_REFRESH ? [] : readJson<string[]>(SEEN_PATH, []);

  console.log("Fetching RSS feeds...");
  const { candidates, timingMs: rssFetchMs } = await gatherCandidates(new Set(baseSeen), maxPerSource);
  console.log(`Found ${candidates.length} not-yet-seen candidate(s) in ${(rssFetchMs / 1000).toFixed(1)}s.\n`);

  const { drafts, skippedLog, processedItemIds, providerBreakdown, timingMs: classifyMs } =
    await classifyCandidates(candidates);

  const seen = new Set<string>(baseSeen);
  for (const id of processedItemIds) seen.add(id);

  const existingCards = readJson<Card[]>(CARDS_PATH, []);
  const { newCards, mergedClustersLog, timingMs: clusteringMs } = await clusterAndBuildCards(drafts, existingCards);

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

  const previousMeta = readJson<EventDetectionState>(META_PATH, {});
  const { recentCandidateCounts, denseModeUntil, spikeDetected } = updateEventDetection(
    previousMeta,
    candidates.length,
    new Date()
  );
  if (spikeDetected) {
    console.log(
      `- Event-aware refresh: ${candidates.length} new candidates is a volume spike — dense mode until ${denseModeUntil}`
    );
  }
  writeJson(META_PATH, {
    lastRunAt: new Date().toISOString(),
    recentCandidateCounts,
    ...(denseModeUntil ? { denseModeUntil } : {}),
  });

  const gameInfoStartedAt = Date.now();
  await fetchNewGameInfo(merged);
  const gameInfoMs = Date.now() - gameInfoStartedAt;

  if (newCards.length > 0) {
    await sendPushForNewCards(newCards);
  }

  const totalMs = Date.now() - startedAt;
  writeJson(LOG_PATH, {
    generatedAt: new Date().toISOString(),
    model,
    providerBreakdown,
    candidatesConsidered: candidates.length,
    newCardsPublished: newCards.length,
    skipped: skippedLog,
    mergedClusters: mergedClustersLog,
    timing: { rssFetchMs, classifyMs, clusteringMs, commentSyncMs, gameInfoMs, totalMs },
    commentCountsUpdated,
  });

  console.log(
    `\nDone in ${(totalMs / 1000).toFixed(1)}s. ${newCards.length} new card(s) added (${skippedLog.length} skipped, ${mergedClustersLog.length} merged), ${merged.length} total in data/cards.json.`
  );
  console.log(`Provider usage — ollama: ${providerBreakdown.ollama}, rule-based: ${providerBreakdown["rule-based"]}`);
}

run().catch((err) => {
  console.error("Ingestion run failed:", err);
  process.exit(1);
});
