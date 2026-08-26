import Parser from "rss-parser";
import { RSS_SOURCES } from "../sources";
import { hashId } from "../slugify";
import type { Candidate, FeedItem, MediaItem } from "./types";

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

/**
 * Fetches every configured RSS feed and returns every item not already in
 * `seen`, up to `maxPerSource` per feed (fair share across outlets rather
 * than one high-volume feed crowding out the rest). No AI/network calls
 * beyond the feeds themselves, and no total cap across sources — with free
 * local Ollama inference there's no cost/rate-limit reason to cap total
 * volume the way a paid-API run once did; MAX_NEW_PER_SOURCE (per-source
 * fairness) is the only volume control left.
 */
export async function gatherCandidates(
  seen: Set<string>,
  maxPerSource: number
): Promise<{ candidates: Candidate[]; timingMs: number; sourceErrors: number }> {
  const startedAt = Date.now();
  const candidates: Candidate[] = [];
  let sourceErrors = 0;

  for (const source of RSS_SOURCES) {
    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (err) {
      console.error(`! Failed to fetch ${source.name} (${source.url}):`, (err as Error).message);
      sourceErrors++;
      continue;
    }

    let fromThisSource = 0;
    for (const item of feed.items as FeedItem[]) {
      if (fromThisSource >= maxPerSource) break;
      const link = item.link;
      if (!link) continue;
      const itemId = hashId(link);
      if (seen.has(itemId)) continue;

      candidates.push({ source, item, title: item.title ?? "Untitled", link, itemId });
      fromThisSource++;
    }
  }

  return { candidates, timingMs: Date.now() - startedAt, sourceErrors };
}
