import {
  buildMergePrompt,
  buildPrompt,
  isValidCategory,
  sanitizePlatformTags,
  truncateToWordLimit,
  type SummarizedArticle,
} from "./card-schema";
import { anthropicProvider } from "./providers/anthropic-provider";
import { geminiProvider } from "./providers/gemini-provider";
import { groqProvider } from "./providers/groq-provider";
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
 * Every configured provider, in priority order — OpenRouter/Anthropic
 * first (the paid tiers, when funded), Gemini/Groq as the free fallback
 * tier. Unlike a single "pick one" choice, summarizeArticle/mergeArticles
 * cascade through *all* of these per call: if OpenRouter is configured but
 * out of credits (a real failure, not just "not configured"), the very
 * next call automatically falls through to Anthropic, then Gemini, then
 * Groq, within the same run — a stale/broken key for one provider doesn't
 * stall the whole pipeline as long as another one works. Set
 * OPENROUTER_MODEL / ANTHROPIC_MODEL / GEMINI_MODEL / GROQ_MODEL to
 * override the default model for whichever provider(s) are configured.
 */
export function getConfiguredProviders(): ModelProvider[] {
  const providers: ModelProvider[] = [];
  if (process.env.OPENROUTER_API_KEY) providers.push(openRouterProvider);
  if (process.env.ANTHROPIC_API_KEY) providers.push(anthropicProvider);
  if (process.env.GEMINI_API_KEY) providers.push(geminiProvider);
  if (process.env.GROQ_API_KEY) providers.push(groqProvider);
  return providers;
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
 *
 * Cascades through every configured provider (see getConfiguredProviders)
 * — a provider whose call fails outright (network/auth/credits error, or
 * an unparseable/invalid response) is skipped in favor of the next one,
 * within this same call, rather than the whole article failing.
 */
export async function summarizeArticle(article: {
  title: string;
  content: string;
  sourceName: string;
}): Promise<SummarizeOutcome> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    throw new Error(
      "No model provider configured — set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY."
    );
  }

  for (const provider of providers) {
    let feedback: string | undefined;
    let lastResult: SummarizedArticle | null = null;
    let providerFailed = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const raw = await provider.callForCard(buildPrompt(article, feedback));
      if (!raw) {
        providerFailed = true;
        break;
      }

      if (raw.is_gaming_news === false || raw.is_sensitive === true) {
        return { status: "skipped", reason: skipReason(raw) };
      }

      if (!isValidCategory(raw.category)) {
        console.error(
          `  ! Invalid category "${raw.category}" for "${article.title}" via ${provider.name}, trying next provider`
        );
        providerFailed = true;
        break;
      }

      const input = toSummarizedArticle(raw);
      lastResult = input;

      if (countWords(input.summary) <= MAX_SUMMARY_WORDS) {
        return { status: "ok", card: input };
      }

      feedback = `Your previous summary was ${countWords(input.summary)} words — over the ${MAX_SUMMARY_WORDS}-word limit. Rewrite it shorter.`;
    }

    if (!providerFailed && lastResult) {
      lastResult.summary = truncateToWordLimit(lastResult.summary, MAX_SUMMARY_WORDS);
      return { status: "ok", card: lastResult };
    }
    // providerFailed (or no usable result) — fall through to the next provider.
  }

  return { status: "failed" };
}

/**
 * Combines multiple already-classified articles about the same story (see
 * dedup.ts's isSameStory) into a single card via one call, instead of
 * picking one arbitrarily or publishing several near-duplicates. Every
 * contributing article has already individually passed summarizeArticle's
 * classification, so this doesn't re-check is_gaming_news/is_sensitive —
 * buildMergePrompt tells the model they're pre-confirmed clean. Cascades
 * across providers the same way summarizeArticle does.
 */
export async function mergeArticles(
  articles: { title: string; content: string; sourceName: string }[]
): Promise<SummarizedArticle | null> {
  const providers = getConfiguredProviders();
  if (providers.length === 0) {
    throw new Error(
      "No model provider configured — set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY."
    );
  }

  for (const provider of providers) {
    let feedback: string | undefined;
    let lastResult: SummarizedArticle | null = null;
    let providerFailed = false;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const raw = await provider.callForCard(buildMergePrompt(articles, feedback));
      if (!raw) {
        providerFailed = true;
        break;
      }

      if (!isValidCategory(raw.category)) {
        console.error(`  ! Invalid category for merged cluster via ${provider.name}, trying next provider`);
        providerFailed = true;
        break;
      }

      const input = toSummarizedArticle(raw);
      lastResult = input;

      if (countWords(input.summary) <= MAX_SUMMARY_WORDS) {
        return input;
      }

      feedback = `Your previous summary was ${countWords(input.summary)} words — over the ${MAX_SUMMARY_WORDS}-word limit. Rewrite it shorter.`;
    }

    if (!providerFailed && lastResult) {
      lastResult.summary = truncateToWordLimit(lastResult.summary, MAX_SUMMARY_WORDS);
      return lastResult;
    }
  }

  return null;
}
