import {
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

/**
 * Summarizes one article into card fields via a forced tool call (reliable
 * structured output vs. parsing free text). Retries once if the model goes
 * over the word cap; if it's still over after that, hard-truncates at the
 * word boundary rather than dropping the article — CLAUDE.md's 60-word cap
 * is "no exceptions", so the guarantee has to hold even when the model
 * doesn't cooperate.
 */
export async function summarizeArticle(article: {
  title: string;
  content: string;
  sourceName: string;
}): Promise<SummarizedArticle | null> {
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
    if (!raw) return lastResult;

    if (!isValidCategory(raw.category)) {
      console.error(`  ! Invalid category "${raw.category}" for "${article.title}", skipping`);
      return null;
    }

    const input: SummarizedArticle = {
      headline: String(raw.headline ?? ""),
      summary: String(raw.summary ?? ""),
      category: raw.category,
      platform_tags: sanitizePlatformTags(raw.platform_tags),
      hype_signal: typeof raw.hype_signal === "number" ? raw.hype_signal : null,
      game_label: typeof raw.game_label === "string" ? raw.game_label : null,
    };

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
