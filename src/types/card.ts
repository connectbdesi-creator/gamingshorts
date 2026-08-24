import type { CategorySlug } from "@/lib/categories";
import type { PlatformSlug } from "@/lib/platforms";

/**
 * Canonical card schema (CLAUDE.md > Open Items). Field names are
 * snake_case to match 1:1 with the future Supabase table columns and the
 * Phase 5 ingestion pipeline's JSON output — no translation layer between
 * DB, pipeline, and app.
 *
 * Two fields beyond the literal Open Items list, both required elsewhere in
 * CLAUDE.md:
 * - `slug` — the Core Product Decisions layout section requires a
 *   permanent per-card URL (`/news/[slug]`), which needs a stable key.
 * - `comment_count` — listed as a required per-card field in the Content
 *   Format section, just omitted from the Open Items field list. Defaults
 *   to 0 in mock data until Phase 4 wires real comments.
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
}

export const MAX_SUMMARY_WORDS = 60;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function isSummaryWithinLimit(text: string): boolean {
  return countWords(text) <= MAX_SUMMARY_WORDS;
}
