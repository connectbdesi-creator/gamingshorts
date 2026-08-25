import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import { isDuplicateTitle } from "./dedup";
import { fetchGameInfo } from "./game-info";
import { sendPushForNewCards } from "./push";
import { getActiveProvider, summarizeArticle } from "./summarize";
import { RSS_SOURCES, type RssSource } from "./sources";
import { hashId, slugify, slugifyGameName } from "./slugify";
import { isWithinHours } from "@/lib/format";
import type { Card } from "@/types/card";
import type { GameInfo } from "@/types/game-info";

const DATA_DIR = path.join(process.cwd(), "data");
const CARDS_PATH = path.join(DATA_DIR, "cards.json");
const SEEN_PATH = path.join(DATA_DIR, "seen.json");
const GAMES_PATH = path.join(DATA_DIR, "games.json");

const MAX_CARDS = 200;
const FORCE_REFRESH = process.env.FORCE_REFRESH === "true";
const MAX_NEW_PER_SOURCE = FORCE_REFRESH ? 15 : 5;
const MAX_NEW_TOTAL = FORCE_REFRESH ? 120 : 40;
// How far back to look at already-published cards when checking whether a
// candidate duplicates a story that got covered in an earlier run.
const RECENT_CARD_WINDOW_HOURS = 48;

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

  // Phase 1: gather every not-yet-seen item across all feeds first, instead
  // of summarizing as we go — this is what lets duplicate-story detection
  // (phase 2) see the full candidate pool before anything gets processed.
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

  // Phase 2: drop candidates that look like the same story as something
  // already accepted this run, or already published recently — multiple
  // outlets frequently run near-identical headlines for the same wire
  // story/press release. Duplicates are marked seen (not retried) since
  // the story itself is already covered, just via a different source.
  const recentHeadlines = existingCards
    .filter((c) => isWithinHours(c.published_at, RECENT_CARD_WINDOW_HOURS))
    .map((c) => c.headline);

  const acceptedTitles = [...recentHeadlines];
  const dedupedCandidates: Candidate[] = [];
  for (const candidate of candidates) {
    if (isDuplicateTitle(candidate.title, acceptedTitles)) {
      console.log(
        `  = Skipping duplicate story (${candidate.source.name}): "${candidate.title}"`
      );
      seen.add(candidate.itemId);
      continue;
    }
    acceptedTitles.push(candidate.title);
    dedupedCandidates.push(candidate);
  }

  // Phase 3: summarize survivors, respecting the total-per-run cap.
  const newCards: Card[] = [];
  for (const { source, item, title, link, itemId } of dedupedCandidates) {
    if (newCards.length >= MAX_NEW_TOTAL) break;

    const content = item.contentSnippet ?? item.content ?? item.summary ?? title;

    console.log(`- Summarizing "${title}" (${source.name})`);
    const summarized = await summarizeArticle({
      title,
      content: content.slice(0, 3000),
      sourceName: source.name,
    });

    if (!summarized) {
      console.error(`  ! Skipped (summarization failed, will retry next run): ${title}`);
      // Not marked seen — a failed call is usually systemic (bad/missing
      // key, rate limit), not something wrong with this specific article,
      // so it should be retried once the real issue is fixed rather than
      // permanently blacklisted.
      continue;
    }

    seen.add(itemId);

    const publishedAt =
      item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString());

    const card: Card = {
      id: itemId,
      slug: slugify(summarized.headline, link),
      headline: summarized.headline,
      summary: summarized.summary,
      category: summarized.category,
      platform_tags: summarized.platform_tags,
      source_name: source.name,
      source_url: link,
      image_url: extractImage(item, itemId),
      published_at: publishedAt,
      hype_signal: summarized.hype_signal,
      like_count: 0,
      comment_count: 0,
      game: summarized.game_label ? slugifyGameName(summarized.game_label) : null,
      game_label: summarized.game_label,
    };

    newCards.push(card);
  }

  // Defensive de-dup by id (= hash of source_url) on top of the seen-set
  // check above — belt and suspenders against ever re-adding the same
  // article twice (e.g. after a seen.json reset), since a duplicate id
  // breaks React's list reconciliation (duplicate keys) wherever cards
  // render, including the reader's card-index tracking. Keeps whichever
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

  console.log(
    `\nDone. ${newCards.length} new card(s) added, ${merged.length} total in data/cards.json.`
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
