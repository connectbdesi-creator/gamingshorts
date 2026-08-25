import {
  buildMergePrompt,
  buildPrompt,
  isValidCategory,
  sanitizePlatformTags,
  truncateToWordLimit,
  type SummarizedArticle,
} from "./card-schema";
import { anthropicProvider } from "./providers/anthropic-provider";
import { openRouterProvider } from "./providers/openrouter-provider";
import type { ModelProvider } from "./providers/types";
import { MAX_SUMMARY_WORDS, countWords } from "@/types/card";

const MAX_ATTEMPTS = 2;

/**
 * "skipped" is distinct from "failed": it's a real content judgment (not
 * gaming news, or sensitive content — see is_gaming_news/is_sensitive in
 * card-schema.ts), not a transient error, so the caller should permanently
 * mark it seen instead of retrying it next run — unlike "failed", which is
 * usually a systemic issue (bad key, rate limit) worth retrying once
 * that's fixed.
 */
export type SummarizeOutcome =
  | { status: "ok"; card: SummarizedArticle }
  | { status: "skipped"; reason: string }
  | { status: "failed" };

/**
 * OpenRouter is preferred when both are configured since it's the more
 * commonly-held key for this project (one key, many models) — but either
 * works standalone. Set OPENROUTER_MODEL / ANTHROPIC_MODEL to override the
 * default model for whichever provider ends up active.
 */
export function getActiveProvider(): ModelProvider | null {
  if (process.env.OPENROUTER_API_KEY) return openRouterProvider;
  if (process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  return null;
}

function skipReason(raw: Record<string, unknown>): string {
  if (typeof raw.skip_reason === "string" && raw.skip_reason.trim()) {
    return raw.skip_reason.trim();
  }
  return raw.is_sensitive === true ? "sensitive content" : "not gaming news";
}

function toSummarizedArticle(raw: Record<string, unknown>): SummarizedArticle {
  return {
    headline: String(raw.headline ?? ""),
    summary: String(raw.summary ?? ""),
    category: raw.category as SummarizedArticle["category"],
    platform_tags: sanitizePlatformTags(raw.platform_tags),
    hype_signal: typeof raw.hype_signal === "number" ? raw.hype_signal : null,
    game_label: typeof raw.game_label === "string" ? raw.game_label : null,
  };
}

/**
 * Summarizes one article into card fields via a forced tool call (reliable
 * structured output vs. parsing free text). Retries once if the model goes
 * over the word cap; if it's still over after that, hard-truncates at the
 * word boundary rather than dropping the article — CLAUDE.md's 60-word cap
 * is "no exceptions", so the guarantee has to hold even when the model
 * doesn't cooperate. Rejects articles the model judges aren't actually
 * gaming news, or are sensitive content (see is_gaming_news/is_sensitive in
 * card-schema.ts) — several sources (Kotaku, Polygon, etc.) run a general
 * entertainment/tech feed alongside their gaming coverage, not just games.
 */
export async function summarizeArticle(article: {
  title: string;
  content: string;
  sourceName: string;
}): Promise<SummarizeOutcome> {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error(
      "No model provider configured — set OPENROUTER_API_KEY or ANTHROPIC_API_KEY."
    );
  }

  let feedback: string | undefined;
  let lastResult: SummarizedArticle | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await provider.callForCard(buildPrompt(article, feedback));
    if (!raw) return lastResult ? { status: "ok", card: lastResult } : { status: "failed" };

    if (raw.is_gaming_news === false || raw.is_sensitive === true) {
      return { status: "skipped", reason: skipReason(raw) };
    }

    if (!isValidCategory(raw.category)) {
      console.error(`  ! Invalid category "${raw.category}" for "${article.title}", skipping`);
      return { status: "failed" };
    }

    const input = toSummarizedArticle(raw);
    lastResult = input;

    if (countWords(input.summary) <= MAX_SUMMARY_WORDS) {
      return { status: "ok", card: input };
    }

    feedback = `Your previous summary was ${countWords(input.summary)} words — over the ${MAX_SUMMARY_WORDS}-word limit. Rewrite it shorter.`;
  }

  if (lastResult) {
    lastResult.summary = truncateToWordLimit(lastResult.summary, MAX_SUMMARY_WORDS);
    return { status: "ok", card: lastResult };
  }
  return { status: "failed" };
}

/**
 * Combines multiple already-classified articles about the same story (see
 * dedup.ts's isSameStory) into a single card via one call, instead of
 * picking one arbitrarily or publishing several near-duplicates. Every
 * contributing article has already individually passed summarizeArticle's
 * classification, so this doesn't re-check is_gaming_news/is_sensitive —
 * buildMergePrompt tells the model they're pre-confirmed clean.
 */
export async function mergeArticles(
  articles: { title: string; content: string; sourceName: string }[]
): Promise<SummarizedArticle | null> {
  const provider = getActiveProvider();
  if (!provider) {
    throw new Error(
      "No model provider configured — set OPENROUTER_API_KEY or ANTHROPIC_API_KEY."
    );
  }

  let feedback: string | undefined;
  let lastResult: SummarizedArticle | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const raw = await provider.callForCard(buildMergePrompt(articles, feedback));
    if (!raw) return lastResult;

    if (!isValidCategory(raw.category)) {
      console.error(`  ! Invalid category for merged cluster, skipping`);
      return null;
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
  }
  return lastResult;
}
