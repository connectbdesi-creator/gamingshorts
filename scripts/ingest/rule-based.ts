import type { CategorySlug } from "@/lib/categories";
import type { PlatformSlug } from "@/lib/platforms";
import { MAX_SUMMARY_WORDS } from "@/types/card";
import { truncateToWordLimit, type SummarizedArticle, type SummarizeOutcome } from "./card-schema";

// Last-resort classifier — used only when Ollama itself fails to respond
// (not running, timed out, out of memory). Deliberately simple keyword
// matching, not an attempt to match LLM-quality judgment — this exists so a
// local outage still yields real (if rougher) published cards instead of a
// stalled run, not as a primary classification strategy.

const GAMING_KEYWORDS = [
  "game", "games", "gaming", "gamer", "gamers", "playstation", "xbox", "nintendo",
  "switch", "steam", "epic games", "esports", "dlc", "patch", "gameplay",
  "developer", "publisher", "console", "multiplayer", "single-player", "rpg",
  "fps", "mmo", "playtest", "beta", "early access", "speedrun", "modding",
];
const NON_GAMING_KEYWORDS = [
  "movie", "film", "box office", "tv show", "television series",
  "streaming series", "actor", "actress", "album", "concert", "musician",
  "theme park", "celebrity", "red carpet", "comic book",
];
const SENSITIVE_KEYWORDS = [
  "arrest", "arrested", "harassment", "harassed", "protest", "protesters",
  "nsfw", "explicit leak", "leaked nude", "sexual assault",
];

const CATEGORY_KEYWORDS: Record<CategorySlug, string[]> = {
  releases: [],
  reviews: ["review", "we tested", "our verdict", "out of 10", "/10", "our rating"],
  patches: ["patch", "hotfix", "patch notes", "update notes", "bug fix", "bugfix"],
  industry: [
    "layoffs", "acquisition", "acquired", "funding", "studio closure", "ceo",
    "earnings", "lawsuit", "ipo", "shut down", "shutting down",
  ],
  esports: ["esports", "tournament", "championship", "playoffs", "grand final", "prize pool"],
  deals: ["sale", "discount", "% off", "deal", "bundle price", "price drop"],
};

const PLATFORM_KEYWORDS: Record<PlatformSlug, string[]> = {
  pc: ["steam", "epic games store", " pc "],
  playstation: ["playstation", "ps5", "ps4"],
  xbox: ["xbox"],
  switch: ["switch", "nintendo"],
  mobile: ["mobile", "ios", "android"],
  vr: [" vr ", "quest 3", "psvr", "vision pro"],
};

const HYPE_KEYWORDS = [
  "reveal", "revealed", "announce", "announced", "launch", "launches",
  "release", "released", "exclusive", "breaking", "major", "first look",
  "trailer",
];

function countKeywordHits(text: string, keywords: string[]): number {
  let hits = 0;
  for (const kw of keywords) if (text.includes(kw)) hits++;
  return hits;
}

function ruleBasedCategory(text: string): CategorySlug {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [CategorySlug, string[]][]) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return "releases";
}

function ruleBasedPlatforms(text: string): PlatformSlug[] {
  const tags: PlatformSlug[] = [];
  for (const [platform, keywords] of Object.entries(PLATFORM_KEYWORDS) as [PlatformSlug, string[]][]) {
    if (keywords.some((kw) => text.includes(kw))) tags.push(platform);
  }
  return tags;
}

/** 0-100 hype estimate — deliberately simple keyword scoring. */
export function computeHypeScore(text: string): number {
  const hits = countKeywordHits(text.toLowerCase(), HYPE_KEYWORDS);
  return Math.min(100, hits * 15 + 20);
}

/**
 * Keyword-hit relevance/sensitivity check, keyword category/platform
 * tagging, and word-count truncation. No game_label — reliably extracting a
 * specific game name needs real language understanding, not keyword
 * matching, so rule-based cards are never tagged to a game (they just don't
 * cluster/get followed by game — everything else about them still works).
 */
export function ruleBasedClassify(article: { title: string; content: string }): SummarizeOutcome {
  const text = `${article.title} ${article.content}`.toLowerCase();

  const sensitiveHits = countKeywordHits(text, SENSITIVE_KEYWORDS);
  if (sensitiveHits > 0) {
    return {
      status: "skipped",
      reason: "needs_review: sensitive keyword match (rule-based)",
      providerUsed: "rule-based",
    };
  }

  const gamingHits = countKeywordHits(text, GAMING_KEYWORDS);
  const nonGamingHits = countKeywordHits(text, NON_GAMING_KEYWORDS);
  if (gamingHits === 0 || nonGamingHits > gamingHits) {
    return {
      status: "skipped",
      reason: "skip: insufficient gaming relevance (rule-based)",
      providerUsed: "rule-based",
    };
  }

  const card: SummarizedArticle = {
    headline: article.title,
    summary: truncateToWordLimit(article.content, MAX_SUMMARY_WORDS),
    category: ruleBasedCategory(text),
    platform_tags: ruleBasedPlatforms(text),
    hype_signal: computeHypeScore(text),
    game_label: null,
  };
  return { status: "ok", card, providerUsed: "rule-based" };
}
