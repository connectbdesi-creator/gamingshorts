import { callOllamaJson } from "./providers/ollama-provider";
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

// Below the "definite" thresholds above but above these, two headlines
// aren't confidently the same story OR confidently unrelated by title
// overlap alone — that middle band gets a real Ollama call to decide
// (see confirmSameStoryWithOllama) instead of being silently treated as
// "not a match", which is what a single-threshold heuristic would do.
const AMBIGUOUS_GAME_MATCH_THRESHOLD = 0.15;
const AMBIGUOUS_THRESHOLD = 0.25;

export type StoryRelation = "match" | "ambiguous" | "no-match";

/**
 * Cheap heuristic (game tag + title token overlap) classification of
 * whether two articles are coverage of the same underlying story — cheap
 * enough to run on every pair without an AI call. "match"/"no-match" are
 * confident enough to act on directly; "ambiguous" needs confirmSameStory-
 * WithOllama to resolve.
 */
export function classifyStorySimilarity(
  a: { headline: string; gameLabel: string | null },
  b: { headline: string; gameLabel: string | null }
): StoryRelation {
  const similarity = titleSimilarity(a.headline, b.headline);
  const sameGame =
    a.gameLabel !== null &&
    b.gameLabel !== null &&
    slugifyGameName(a.gameLabel) === slugifyGameName(b.gameLabel);

  if (sameGame) {
    if (similarity >= GAME_MATCH_THRESHOLD) return "match";
    if (similarity >= AMBIGUOUS_GAME_MATCH_THRESHOLD) return "ambiguous";
    return "no-match";
  }

  if (similarity >= DUPLICATE_THRESHOLD) return "match";
  if (similarity >= AMBIGUOUS_THRESHOLD) return "ambiguous";
  return "no-match";
}

interface StoryLike {
  headline: string;
  summary: string;
  sourceName: string;
}

function buildClusterConfirmPrompt(a: StoryLike, b: StoryLike): string {
  return `The following two articles may be covering the same video game news story. Decide:
- "merge": definitely the same underlying story, just covered by different outlets.
- "possible_duplicate": likely related but not certainly the exact same story — should be kept separate.
- "separate": actually distinct stories that just happen to share surface keywords or entities.

1. [${a.sourceName}] ${a.headline}
${a.summary}

2. [${b.sourceName}] ${b.headline}
${b.summary}

Respond with ONLY a single valid JSON object, no markdown, no commentary, matching exactly this shape:
{"decision": "merge"|"possible_duplicate"|"separate", "reason": string}`;
}

/**
 * Confirms an "ambiguous" classifyStorySimilarity() verdict via Ollama —
 * only called for the middle band where title-token overlap alone isn't
 * confident either way (see run.ts's isSameStory). Defaults to false (keep
 * separate) if Ollama is unreachable or returns anything but "merge" — the
 * safer default, since publishing a near-duplicate pair is a much smaller
 * problem than silently losing a source's coverage inside a wrongly-merged
 * card.
 */
export async function confirmSameStoryWithOllama(a: StoryLike, b: StoryLike): Promise<boolean> {
  const raw = await callOllamaJson(buildClusterConfirmPrompt(a, b));
  return raw?.decision === "merge";
}
