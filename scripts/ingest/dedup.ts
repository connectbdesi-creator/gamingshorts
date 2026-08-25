import { slugifyGameName } from "./slugify";

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "for", "to", "and", "with", "is",
  "are", "at", "by", "as", "from", "its", "it", "after", "over", "amid",
  "into", "new",
]);

// Common gaming abbreviations expanded to their full name before tokenizing,
// so "GTA 6" and "Grand Theft Auto 6" share tokens instead of missing each
// other entirely. Deliberately a short, high-confidence list rather than an
// attempt at exhaustive coverage — add to it as real misses show up in the
// ingestion logs ("= Skipping duplicate story" lines that should have fired
// but didn't).
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bgta\b/g, "grand theft auto"],
  [/\bcod\b/g, "call of duty"],
  [/\bmgs\b/g, "metal gear solid"],
  [/\bff\b/g, "final fantasy"],
  [/\bbotw\b/g, "breath of the wild"],
  [/\btotk\b/g, "tears of the kingdom"],
];

function expandAbbreviations(title: string): string {
  let expanded = title.toLowerCase();
  for (const [pattern, replacement] of ABBREVIATIONS) {
    expanded = expanded.replace(pattern, replacement);
  }
  return expanded;
}

function significantWords(title: string): Set<string> {
  return new Set(
    expandAbbreviations(title)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/**
 * Jaccard similarity over significant (non-stopword) tokens, after
 * expanding common abbreviations. A cheap, dependency-free heuristic for
 * "these two headlines are probably about the same story" — not perfect,
 * but catches the common case of multiple outlets running near-identical
 * headlines for the same wire story or press release.
 */
export function titleSimilarity(a: string, b: string): number {
  const setA = significantWords(a);
  const setB = significantWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection++;

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const DUPLICATE_THRESHOLD = 0.5;

// Same signal as DUPLICATE_THRESHOLD, but only needs to clear a much lower
// bar when both articles already agree on the specific game — that
// agreement alone is a strong prior that they're the same story, so the
// headline text doesn't have to overlap nearly as much before treating
// them as one. Stories with no game tag (industry/business, cross-outlet
// leak coverage) fall back to the higher game-agnostic threshold.
const GAME_MATCH_THRESHOLD = 0.3;

/**
 * Decides whether two articles are coverage of the same underlying story —
 * used both to catch same-run duplicates before they become separate cards
 * and to match a new article against a recently-published card so outlets
 * get merged into one card's `sources` instead of spawning near-duplicates
 * (see run.ts). Deliberately a cheap heuristic (game tag + title token
 * overlap), not embeddings — good enough for the common "N outlets ran the
 * same wire story" case without the infra cost of a real similarity model.
 */
export function isSameStory(
  a: { headline: string; gameLabel: string | null },
  b: { headline: string; gameLabel: string | null }
): boolean {
  const similarity = titleSimilarity(a.headline, b.headline);
  const sameGame =
    a.gameLabel !== null &&
    b.gameLabel !== null &&
    slugifyGameName(a.gameLabel) === slugifyGameName(b.gameLabel);

  if (sameGame && similarity >= GAME_MATCH_THRESHOLD) return true;
  return similarity >= DUPLICATE_THRESHOLD;
}
