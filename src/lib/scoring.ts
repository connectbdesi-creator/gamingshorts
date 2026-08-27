import type { Card } from "@/types/card";

/**
 * CLAUDE.md's "scoring/importance algorithm (source quality + recency +
 * keyword signals + hype/discussion velocity)" — one shared scoring
 * engine, four 0-1 normalized signals, combined with page-specific
 * weights (see TRENDING_WEIGHTS / HOT_TOPICS_WEIGHTS below) rather than
 * each page hand-rolling its own ad-hoc field-by-field tiebreak sort.
 *
 * "Keyword signals" isn't a separate term here — it already feeds into
 * hype_signal at ingestion time (card-schema.ts's hype_signal instructions
 * to the model, and rule-based.ts's HYPE_KEYWORDS for the fallback path),
 * so treating it as a distinct signal here would double-weight the same
 * underlying evidence.
 */

// Established outlets with dedicated editorial desks and/or official
// platform-holder status weighted highest; smaller, single-topic, or
// regional sites lower. This is a *coverage-breadth* proxy, not a verdict
// on any outlet's writing quality — it's one signal among several, not a
// ranking of the sources themselves.
const SOURCE_QUALITY: Record<string, number> = {
  IGN: 1.0,
  GameSpot: 1.0,
  "PlayStation Blog": 1.0,
  "Xbox Wire": 1.0,
  Polygon: 0.95,
  Eurogamer: 0.95,
  "PC Gamer": 0.9,
  Kotaku: 0.9,
  Steam: 0.9,
  "GamesIndustry.biz": 0.9,
  "Rock Paper Shotgun": 0.85,
  VG247: 0.85,
  "GamesRadar+": 0.85,
  "Nintendo Life": 0.8,
  "Push Square": 0.8,
  "Pure Xbox": 0.8,
  VentureBeat: 0.8,
  VGC: 0.8,
  "Game Rant": 0.75,
  TheGamer: 0.75,
  Automaton: 0.7,
  Gematsu: 0.7,
};
const DEFAULT_SOURCE_QUALITY = 0.7;

function sourceQualityScore(card: Card): number {
  if (card.sources.length === 0) return DEFAULT_SOURCE_QUALITY;
  const best = Math.max(...card.sources.map((s) => SOURCE_QUALITY[s.name] ?? DEFAULT_SOURCE_QUALITY));
  // Multiple outlets independently running the same story (already
  // clustered into one card by the ingestion pipeline — see
  // scripts/ingest/dedup.ts) is itself a signal of real significance, not
  // just one outlet's traffic-bait — a small bonus per corroborating
  // source on top of the best individual outlet's quality.
  const corroborationBonus = Math.min(0.15, (card.sources.length - 1) * 0.05);
  return Math.min(1, best + corroborationBonus);
}

// Exponential decay — a card is still clearly "current" within the first
// day and fades over the next couple, rather than a hard cliff at some
// arbitrary age cutoff.
const RECENCY_HALF_LIFE_HOURS = 18;

function recencyScore(card: Card, now: number): number {
  const ageHours = Math.max(0, (now - new Date(card.published_at).getTime()) / (1000 * 60 * 60));
  return Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
}

function hypeScore(card: Card): number {
  return (card.hype_signal ?? 0) / 100;
}

function engagementScore(card: Card): number {
  // A comment is a much stronger engagement signal than a one-tap like —
  // weighted accordingly. Log-scaled so one viral outlier doesn't dominate
  // the whole ranking, just gets diminishing-returns credit for it.
  const raw = card.comment_count * 3 + card.like_count;
  return Math.min(1, Math.log10(raw + 1) / 3); // log10(1000+1) ~= 3 -> ~1.0 at real "viral" volumes
}

export interface ScoreWeights {
  sourceQuality: number;
  recency: number;
  hype: number;
  engagement: number;
}

/** "What's significant right now" — recency- and hype-led. */
export const TRENDING_WEIGHTS: ScoreWeights = {
  sourceQuality: 0.15,
  recency: 0.4,
  hype: 0.3,
  engagement: 0.15,
};

/** "What people are actually discussing" — engagement-led; a card a few
 * days old with active discussion should still rank well here, unlike on
 * Trending. */
export const HOT_TOPICS_WEIGHTS: ScoreWeights = {
  sourceQuality: 0.1,
  recency: 0.15,
  hype: 0.15,
  engagement: 0.6,
};

export function computeImportanceScore(card: Card, weights: ScoreWeights, now: number = Date.now()): number {
  return (
    sourceQualityScore(card) * weights.sourceQuality +
    recencyScore(card, now) * weights.recency +
    hypeScore(card) * weights.hype +
    engagementScore(card) * weights.engagement
  );
}

export function rankByImportance(cards: Card[], weights: ScoreWeights, now: number = Date.now()): Card[] {
  return [...cards].sort((a, b) => computeImportanceScore(b, weights, now) - computeImportanceScore(a, weights, now));
}
