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

export function isDuplicateTitle(title: string, against: string[]): boolean {
  return against.some((existing) => titleSimilarity(title, existing) >= DUPLICATE_THRESHOLD);
}
