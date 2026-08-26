import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import type { SummarizedArticle } from "./card-schema";
import { isSameStory } from "./dedup";
import { fetchGameInfo } from "./game-info";
import { sendPushForNewCards } from "./push";
import { getActiveProvider, mergeArticles, summarizeArticle } from "./summarize";
import { RSS_SOURCES, type RssSource } from "./sources";
import { hashId, slugify, slugifyGameName } from "./slugify";
import { isWithinHours } from "@/lib/format";
import type { Card, CardSource } from "@/types/card";
import type { GameInfo } from "@/types/game-info";

const DATA_DIR = path.join(process.cwd(), "data");
const CARDS_PATH = path.join(DATA_DIR, "cards.json");
const SEEN_PATH = path.join(DATA_DIR, "seen.json");
const GAMES_PATH = path.join(DATA_DIR, "games.json");
const META_PATH = path.join(DATA_DIR, "meta.json");
// QC-only artifact for spot-checking the classifier/clustering — never
// committed (see .gitignore), overwritten fresh every run. Uploaded as a
// GitHub Actions artifact by the workflow so it's still inspectable
// without a local run.
const LOG_PATH = path.join(DATA_DIR, "ingestion-log.json");

const MAX_CARDS = 200;
const FORCE_REFRESH = process.env.FORCE_REFRESH === "true";
const MAX_NEW_PER_SOURCE = FORCE_REFRESH ? 15 : 5;
const MAX_NEW_TOTAL = FORCE_REFRESH ? 120 : 40;
// How far back to look — among both this run's survivors and already-
// published cards — when clustering same-story coverage together.
const CLUSTER_WINDOW_HOURS = 12;

type MediaItem = { $?: { url?: string } };
type FeedItem = {
  link?: string;
  title?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  mediaContent?: MediaItem[];
};

interface Candidate {
  source: RssSource;
  item: FeedItem;
  title: string;
  link: string;
  itemId: string;
}

/** A candidate that survived classification, with its draft (single-source)
 * summary — either becomes its own card, or gets folded into a cluster. */
interface Draft {
  candidate: Candidate;
  summary: SummarizedArticle;
  content: string;
  publishedAt: string;
}

interface SkippedLogEntry {
  source: string;
  title: string;
  reason: string;
}

interface MergedClusterLogEntry {
  headline: string;
  sources: string[];
  mode: "new-cluster" | "matched-existing";
}

const parser = new Parser<object, { enclosure?: { url?: string }; mediaContent?: MediaItem[] }>({
  headers: {
    // Several outlets (e.g. Xbox Wire) block the default Node UA.
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 GameShortsBot/1.0",
  },
  customFields: {
    item: [["media:content", "mediaContent", { keepArray: true }]],
  },
});

function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function extractImage(item: FeedItem, seed: string): string {
  const fromEnclosure = item.enclosure?.url;
  const fromMedia = item.mediaContent?.[0]?.$?.url;
  return fromEnclosure || fromMedia || `https://picsum.photos/seed/${seed}/800/600`;
}

function buildCard(
  primary: { candidate: Candidate; summary: SummarizedArticle },
  sources: CardSource[],
  publishedAt: string
): Card {
  const primaryLink = sources[0].url;
  const id = hashId(primaryLink);

  return {
    id,
    slug: slugify(primary.summary.headline, primaryLink),
    headline: primary.summary.headline,
    summary: primary.summary.summary,
    category: primary.summary.category,
    platform_tags: primary.summary.platform_tags,
    sources,
    image_url: extractImage(primary.candidate.item, id),
    published_at: publishedAt,
    hype_signal: primary.summary.hype_signal,
    like_count: 0,
    comment_count: 0,
    game: primary.summary.game_label ? slugifyGameName(primary.summary.game_label) : null,
    game_label: primary.summary.game_label,
  };
}

async function run() {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error(
      "No model provider configured — set OPENROUTER_API_KEY or ANTHROPIC_API_KEY before running ingestion."
    );
  }
  console.log(`Using ${provider.name} for summarization.\n`);

  fs.mkdirSync(DATA_DIR, { recursive: true });

  const existingCards = readJson<Card[]>(CARDS_PATH, []);
  const seen = new Set<string>(FORCE_REFRESH ? [] : readJson<string[]>(SEEN_PATH, []));
  const skippedLog: SkippedLogEntry[] = [];
  const mergedClustersLog: MergedClusterLogEntry[] = [];
  let failedCount = 0;

  // Phase 1: gather every not-yet-seen item across all feeds first.
  const candidates: Candidate[] = [];
  for (const source of RSS_SOURCES) {
    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (err) {
      console.error(`! Failed to fetch ${source.name} (${source.url}):`, (err as Error).message);
      continue;
    }

    let fromThisSource = 0;
    for (const item of feed.items as FeedItem[]) {
      if (fromThisSource >= MAX_NEW_PER_SOURCE) break;
      const link = item.link;
      if (!link) continue;
      const itemId = hashId(link);
      if (seen.has(itemId)) continue;

      candidates.push({ source, item, title: item.title ?? "Untitled", link, itemId });
      fromThisSource++;
    }
  }

  // Phase 2: classify + draft-summarize each candidate (one combined tool
  // call — see card-schema.ts). Non-gaming/sensitive articles are rejected
  // here and never reach clustering or publication. The MAX_NEW_TOTAL cap
  // bounds how many candidates get classified per run (a cost/rate-limit
  // control), same role it played before clustering existed — it's checked
  // against successful classifications, so a noisy run (lots of rejects)
  // still processes enough candidates to find MAX_NEW_TOTAL real stories.
  const drafts: Draft[] = [];
  let consecutiveFailures = 0;
  for (const candidate of candidates) {
    if (drafts.length >= MAX_NEW_TOTAL) break;

    // A run-ending failure (bad/expired key, provider outage, exhausted
    // rate limit) doesn't stop the loop on its own — "failed" only skips
    // that one candidate — so without this it'd burn through every
    // remaining candidate (up to MAX_NEW_PER_SOURCE * RSS_SOURCES.length,
    // ~100+) making the exact same failing call each time. 5 in a row is a
    // clear enough signal that this run isn't going to succeed.
    if (consecutiveFailures >= 5) {
      console.error(
        `  ! ${consecutiveFailures} consecutive summarization failures — stopping this run early instead of repeating the same failure through the rest of the candidates.`
      );
      break;
    }

    const content =
      candidate.item.contentSnippet ?? candidate.item.content ?? candidate.item.summary ?? candidate.title;

    console.log(`- Classifying "${candidate.title}" (${candidate.source.name})`);
    const outcome = await summarizeArticle({
      title: candidate.title,
      content: content.slice(0, 3000),
      sourceName: candidate.source.name,
    });

    if (outcome.status === "skipped") {
      console.log(`  = Skipped (${outcome.reason}): "${candidate.title}" [${candidate.source.name}]`);
      skippedLog.push({ source: candidate.source.name, title: candidate.title, reason: outcome.reason });
      // Marked seen — this is a content judgment, not a transient failure,
      // so it shouldn't be retried every run forever.
      seen.add(candidate.itemId);
      consecutiveFailures = 0;
      continue;
    }

    if (outcome.status === "failed") {
      console.error(`  ! Failed (will retry next run): "${candidate.title}"`);
      // Not marked seen — usually a systemic issue (bad key, rate limit),
      // not something wrong with this specific article.
      failedCount++;
      consecutiveFailures++;
      continue;
    }

    const publishedAt =
      candidate.item.isoDate ??
      (candidate.item.pubDate ? new Date(candidate.item.pubDate).toISOString() : new Date().toISOString());

    drafts.push({ candidate, summary: outcome.card, content: content.slice(0, 3000), publishedAt });
    consecutiveFailures = 0;
  }

  // Phase 3: clustering. First, fold any draft that covers the same story
  // as an already-published recent card into that card's `sources`
  // instead of creating a new one.
  const existingRecent = existingCards.filter((c) => isWithinHours(c.published_at, CLUSTER_WINDOW_HOURS));
  const unmatchedDrafts: Draft[] = [];

  for (const draft of drafts) {
    const match = existingRecent.find((c) =>
      isSameStory(
        { headline: draft.candidate.title, gameLabel: draft.summary.game_label },
        { headline: c.headline, gameLabel: c.game_label }
      )
    );

    if (match) {
      const alreadyCredited = match.sources.some((s) => s.url === draft.candidate.link);
      if (!alreadyCredited) match.sources.push({ name: draft.candidate.source.name, url: draft.candidate.link });
      if (new Date(draft.publishedAt).getTime() > new Date(match.published_at).getTime()) {
        match.published_at = draft.publishedAt;
      }
      seen.add(draft.candidate.itemId);
      console.log(`  = Merged into existing card (+${draft.candidate.source.name}): "${match.headline}"`);
      mergedClustersLog.push({
        headline: match.headline,
        sources: match.sources.map((s) => s.name),
        mode: "matched-existing",
      });
      continue;
    }

    unmatchedDrafts.push(draft);
  }

  // Then greedily group the remaining this-run drafts among themselves.
  // Small N per run (well under MAX_NEW_TOTAL), so an O(n^2) pass is fine —
  // not worth a smarter clustering algorithm for this volume.
  const clusters: Draft[][] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < unmatchedDrafts.length; i++) {
    if (consumed.has(i)) continue;
    const group = [unmatchedDrafts[i]];
    consumed.add(i);

    for (let j = i + 1; j < unmatchedDrafts.length; j++) {
      if (consumed.has(j)) continue;
      const matchesGroup = group.some((g) =>
        isSameStory(
          { headline: g.candidate.title, gameLabel: g.summary.game_label },
          { headline: unmatchedDrafts[j].candidate.title, gameLabel: unmatchedDrafts[j].summary.game_label }
        )
      );
      if (matchesGroup) {
        group.push(unmatchedDrafts[j]);
        consumed.add(j);
      }
    }

    clusters.push(group);
  }

  // Phase 4: turn each cluster into its final card — a single-draft
  // cluster is already a finished card, a multi-draft cluster gets one
  // combined summary via mergeArticles().
  const newCards: Card[] = [];
  for (const group of clusters) {
    if (group.length === 1) {
      const draft = group[0];
      newCards.push(
        buildCard(draft, [{ name: draft.candidate.source.name, url: draft.candidate.link }], draft.publishedAt)
      );
      seen.add(draft.candidate.itemId);
      continue;
    }

    const sortedByTime = [...group].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
    const primaryDraft = sortedByTime[0];
    const latestPublishedAt = sortedByTime[sortedByTime.length - 1].publishedAt;
    const sources: CardSource[] = group.map((d) => ({ name: d.candidate.source.name, url: d.candidate.link }));

    console.log(
      `- Merging ${group.length} articles into one card: ${group.map((d) => `"${d.candidate.title}" (${d.candidate.source.name})`).join("; ")}`
    );
    const merged = await mergeArticles(
      group.map((d) => ({ title: d.candidate.title, content: d.content, sourceName: d.candidate.source.name }))
    );

    if (merged) {
      newCards.push(buildCard({ candidate: primaryDraft.candidate, summary: merged }, sources, latestPublishedAt));
      for (const d of group) seen.add(d.candidate.itemId);
      console.log(`  = Merged card: "${merged.headline}" [${sources.map((s) => s.name).join(", ")}]`);
      mergedClustersLog.push({
        headline: merged.headline,
        sources: sources.map((s) => s.name),
        mode: "new-cluster",
      });
    } else {
      // Merge call failed — publish each individually rather than losing
      // valid gaming news over an LLM hiccup.
      console.error(`  ! Merge call failed for cluster, publishing ${group.length} articles separately`);
      for (const d of group) {
        newCards.push(buildCard(d, [{ name: d.candidate.source.name, url: d.candidate.link }], d.publishedAt));
        seen.add(d.candidate.itemId);
      }
    }
  }

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

  writeJson(CARDS_PATH, merged);
  writeJson(SEEN_PATH, Array.from(seen));
  // Written every run regardless of whether new cards were found — this is
  // "when did the cron last check", not "when did it last find something",
  // which is what the header's last-refresh indicator actually needs.
  writeJson(META_PATH, { lastRunAt: new Date().toISOString() });
  writeJson(LOG_PATH, {
    generatedAt: new Date().toISOString(),
    candidatesConsidered: candidates.length,
    newCardsPublished: newCards.length,
    failedCount,
    skipped: skippedLog,
    mergedClusters: mergedClustersLog,
  });

  console.log(
    `\nDone. ${newCards.length} new card(s) added (${skippedLog.length} skipped, ${mergedClustersLog.length} merged, ${failedCount} failed), ${merged.length} total in data/cards.json.`
  );

  // Scans the full merged set, not just newCards — a game can already have
  // cards from before RAWG_API_KEY was configured (or from before it was
  // ever successfully looked up), and this is what backfills those on the
  // next run rather than waiting for a fresh article about that game.
  await fetchNewGameInfo(merged);

  if (newCards.length > 0) {
    await sendPushForNewCards(newCards);
  }
}

/**
 * Fetches RAWG metadata (see game-info.ts) for every game in `cards` that
 * doesn't already have an entry in data/games.json — existing entries are
 * never re-fetched, which keeps this well within RAWG's free-tier request
 * budget. No-ops entirely if RAWG_API_KEY isn't set (fetchGameInfo returns
 * null for every call, so nothing gets added).
 */
async function fetchNewGameInfo(cards: Card[]) {
  const games = readJson<GameInfo[]>(GAMES_PATH, []);
  const knownSlugs = new Set(games.map((g) => g.slug));

  const newGames = new Map<string, string>(); // slug -> label
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

run().catch((err) => {
  console.error("Ingestion run failed:", err);
  process.exit(1);
});
