import type { CategorySlug } from "@/lib/categories";
import type { PlatformSlug } from "@/lib/platforms";

/**
 * Canonical card schema (CLAUDE.md > Open Items). Field names are
 * snake_case to match 1:1 with the future Supabase table columns and the
 * Phase 5 ingestion pipeline's JSON output — no translation layer between
 * DB, pipeline, and app.
 *
 * Fields beyond the literal Open Items list, all required elsewhere:
 * - `slug` — the Core Product Decisions layout section requires a
 *   permanent per-card URL (`/news/[slug]`), which needs a stable key.
 * - `comment_count` — listed as a required per-card field in the Content
 *   Format section, just omitted from the Open Items field list. Defaults
 *   to 0 in mock data until Phase 4 wires real comments.
 * - `game` / `game_label` — which specific game this news is about, so
 *   users can follow a game and get its news (and pushes) across
 *   categories. Not every card is about one specific game (industry
 *   roundups, storewide sales), so both are nullable. `game` is a stable
 *   slug (join key for follows/pushes/`/game/[slug]`); `game_label` is the
 *   display name. Set by the ingestion pipeline's Claude call, same as
 *   category/platform_tags — there's no fixed game registry, it's derived
 *   from whatever cards exist (see src/lib/games.ts).
 */
export interface Card {
  id: string;
  slug: string;
  headline: string;
  /** Hard-capped at 60 words. See MAX_SUMMARY_WORDS / countWords below. */
  summary: string;
  category: CategorySlug;
  platform_tags: PlatformSlug[];
  source_name: string;
  source_url: string;
  image_url: string;
  /** ISO 8601 */
  published_at: string;
  /** 0-100 hype/sentiment score. null when no signal is available yet. */
  hype_signal: number | null;
  like_count: number;
  comment_count: number;
  /** Stable slug, e.g. "elden-ring-nightreign". null when not game-specific. */
  game: string | null;
  /** Display name, e.g. "Elden Ring: Nightreign". null when not game-specific. */
  game_label: string | null;
}

export const MAX_SUMMARY_WORDS = 60;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isSummaryWithinLimit(text: string): boolean {
  return countWords(text) <= MAX_SUMMARY_WORDS;
}
