import {
  buildMergePrompt,
  buildPrompt,
  isValidCategory,
  sanitizePlatformTags,
  truncateToWordLimit,
  type SummarizedArticle,
  type SummarizeOutcome,
} from "./card-schema";
import { ollamaProvider } from "./providers/ollama-provider";
import { hasConfidentNonGamingSignal, ruleBasedClassify } from "./rule-based";
import { MAX_SUMMARY_WORDS, countWords } from "@/types/card";

export type { SummarizeOutcome } from "./card-schema";

const MAX_ATTEMPTS = 2;

function skipReason(raw: Record<string, unknown>): string {
  const status = raw.status === "needs_review" ? "needs_review" : "skip";
  const detail = typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : "no reason given";
  return `${status}: ${detail}`;
}

// Ollama occasionally emits the literal string "null" instead of a real
// JSON null for an optional field — a small-model JSON-mode quirk, not
// something the prompt wording alone reliably prevents. Taking it at face
// value produced game_label: "null" on several cards, which slugified to
// an actual /game/null page.
function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return !trimmed || trimmed.toLowerCase() === "null" ? null : trimmed;
}

function toSummarizedArticle(raw: Record<string, unknown>): SummarizedArticle {
  return {
    headline: String(raw.headline ?? ""),
    summary: String(raw.summary ?? ""),
    category: raw.category as SummarizedArticle["category"],
    platform_tags: sanitizePlatformTags(raw.platform_tags),
    hype_signal: typeof raw.hype_signal === "number" ? raw.hype_signal : null,
    game_label: normalizeNullableString(raw.game_label),
  };
}

/**
 * Summarizes one article into card fields via a local Ollama call.
 * Retries once if the model goes over the word cap; if it's still over
 * after that, hard-truncates at the word boundary rather than dropping the
 * article — CLAUDE.md's 60-word cap is "no exceptions", so the guarantee
 * has to hold even when the model doesn't cooperate. Rejects articles the
 * model judges aren't actually gaming news, or are sensitive/ambiguous (see
 * the publish/skip/needs_review status in card-schema.ts) — several sources
 * (Kotaku, Polygon, etc.) run a general entertainment/tech feed alongside
 * their gaming coverage, not just games.
 *
 * Falls back to keyword-based rule classification (rule-based.ts) only if
 * Ollama itself fails to respond at all (down, timed out, out of memory) —
 * this should be rare since there's no billing or rate limit to hit, unlike
 * a hosted API.
 */
export async function summarizeArticle(article: {
  title: string;
  content: string;
  sourceName: string;
}): Promise<SummarizeOutcome> {
  let feedback: string | undefined;
  let lastResult: SummarizedArticle | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await ollamaProvider.callForCard(buildPrompt(article, feedback));
    if (!raw) break;

    if (raw.status === "skip" || raw.status === "needs_review") {
      return { status: "skipped", reason: skipReason(raw), providerUsed: "ollama" };
    }

    if (raw.status !== "publish" || !isValidCategory(raw.category)) {
      console.error(
        `  ! Ollama returned an invalid response for "${article.title}" (status=${String(raw.status)}, category=${String(raw.category)})`
      );
      break;
    }

    // Double-check even a "publish" verdict against the original article's
    // own text — a small local model is more prone than a hosted one to
    // mistaking a gaming outlet's general-entertainment coverage (movie/TV
    // articles Polygon, Kotaku, etc. run alongside their game news) for
    // actual gaming news. Checked here, not just in the rule-based fallback,
    // so it also catches Ollama's own misses, not only Ollama-down cases.
    if (hasConfidentNonGamingSignal(article)) {
      return {
        status: "skipped",
        reason: "skip: failed rule-based relevance double-check (zero gaming keyword hits)",
        providerUsed: "ollama",
      };
    }

    const input = toSummarizedArticle(raw);
    lastResult = input;

    if (countWords(input.summary) <= MAX_SUMMARY_WORDS) {
      return { status: "ok", card: input, providerUsed: "ollama" };
    }

    feedback = `Your previous summary was ${countWords(input.summary)} words — over the ${MAX_SUMMARY_WORDS}-word limit. Rewrite it shorter.`;
  }

  if (lastResult) {
    lastResult.summary = truncateToWordLimit(lastResult.summary, MAX_SUMMARY_WORDS);
    return { status: "ok", card: lastResult, providerUsed: "ollama" };
  }

  console.error(`  ! Ollama unavailable for "${article.title}" — using rule-based fallback`);
  return ruleBasedClassify(article);
}

/**
 * Combines multiple already-classified articles about the same story (see
 * dedup.ts) into a single card via one Ollama call, instead of picking one
 * arbitrarily or publishing several near-duplicates. Every contributing
 * article has already individually passed summarizeArticle's
 * classification, so this doesn't re-check status — buildMergePrompt tells
 * the model they're pre-confirmed clean.
 *
 * Returns null (rather than a rule-based merge) on failure — there's no
 * reasonable keyword-based way to combine multiple articles into one
 * synthesized summary, so the caller (run.ts) publishes each article in the
 * cluster as its own card instead, which is a fine fallback since every one
 * of them already has a real per-article summary from summarizeArticle.
 */
export async function mergeArticles(
  articles: { title: string; content: string; sourceName: string }[]
): Promise<SummarizedArticle | null> {
  let feedback: string | undefined;
  let lastResult: SummarizedArticle | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await ollamaProvider.callForCard(buildMergePrompt(articles, feedback));
    if (!raw) break;

    if (!isValidCategory(raw.category)) {
      console.error(`  ! Ollama returned an invalid category for merged cluster`);
      break;
    }

    const input = toSummarizedArticle(raw);
    lastResult = input;

    if (countWords(input.summary) <= MAX_SUMMARY_WORDS) {
      return input;
    }

    feedback = `Your previous summary was ${countWords(input.summary)} words — over the ${MAX_SUMMARY_WORDS}-word limit. Rewrite it shorter.`;
  }

  if (lastResult) {
    lastResult.summary = truncateToWordLimit(lastResult.summary, MAX_SUMMARY_WORDS);
    return lastResult;
  }

  return null;
}
