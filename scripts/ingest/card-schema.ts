import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { PLATFORMS, type PlatformSlug } from "@/lib/platforms";
import { MAX_SUMMARY_WORDS } from "@/types/card";

export interface SummarizedArticle {
  headline: string;
  summary: string;
  category: CategorySlug;
  platform_tags: PlatformSlug[];
  hype_signal: number | null;
  /** Display name of the single game this article is about, e.g. "Elden Ring". null if not game-specific. */
  game_label: string | null;
}

/**
 * "skipped" is a real content judgment — not gaming news, or gaming-adjacent
 * but sensitive/ambiguous (see the publish/skip/needs_review status in the
 * prompt below) — not a transient error, so the caller marks it permanently
 * seen instead of retrying it next run.
 */
export type SummarizeOutcome =
  | { status: "ok"; card: SummarizedArticle; providerUsed: "ollama" | "rule-based" }
  | { status: "skipped"; reason: string; providerUsed: "ollama" | "rule-based" };

const SYSTEM_PREAMBLE = `You are a strict content classifier and summarizer for a video game news aggregator site. Decide a status for the article below:
- "publish": the article is clearly, substantively about video games — a release, review, patch/update, esports event, game industry business news, or a game storefront deal.
- "skip": the article is clearly NOT gaming news — movies, TV shows, comics, general pop culture, or celebrity news, even if published by a gaming outlet or mentioning a game in passing.
- "needs_review": the article is gaming-adjacent but involves sensitive content (arrests, harassment, protests, explicit/NSFW leaked material, real-world violence) inappropriate for a general gaming news audience, or its gaming relevance is genuinely ambiguous.

If status is "publish", also fill in headline, summary, category, platform_tags, hype_signal, and game_label. Otherwise set reason to a short explanation and leave those fields null/empty — they'll be discarded, only the status and reason matter.`;

export function buildPrompt(
  article: { title: string; content: string; sourceName: string },
  feedback?: string
): string {
  return `${SYSTEM_PREAMBLE}

Source outlet: ${article.sourceName}
Original headline: ${article.title}

Article content:
"""
${article.content}
"""

Rewrite everything in your own words — do not copy sentences from the article. The summary must be ${MAX_SUMMARY_WORDS} words or fewer, no exceptions.${feedback ? `\n\n${feedback}` : ""}`;
}

/**
 * Prompt for merging multiple already-classified articles about the same
 * underlying story (see dedup.ts) into a single card. Every contributing
 * article has already individually passed buildPrompt's classification, so
 * this tells the model to always report status "publish".
 */
export function buildMergePrompt(
  articles: { title: string; content: string; sourceName: string }[],
  feedback?: string
): string {
  const articlesBlock = articles
    .map((a, i) => `${i + 1}. Source: ${a.sourceName}\nHeadline: ${a.title}\n${a.content.slice(0, 1000)}`)
    .join("\n\n");

  return `The following ${articles.length} articles all cover the same underlying video game news story from different outlets — every one has already been individually confirmed as legitimate, on-topic, non-sensitive gaming news, so always report status "publish" with reason null.

${articlesBlock}

Write ONE combined card for this story: a single rewritten headline and a ${MAX_SUMMARY_WORDS}-word-or-fewer summary covering the story itself — not any one outlet's specific angle — plus the single best category, platform tags, hype signal, and game label for it.${feedback ? `\n\n${feedback}` : ""}`;
}

/**
 * Ollama is called in plain JSON mode (format: "json" on /api/generate, no
 * native tool-calling schema), so the expected shape has to be spelled out
 * in the prompt text itself — this appends that shared description to
 * either base prompt.
 */
function buildCardShapeInstructions(): string {
  return `Respond with ONLY a single valid JSON object, no markdown formatting, no commentary, matching exactly this shape:
{"status": "publish"|"skip"|"needs_review", "reason": string|null, "headline": string|null, "summary": string|null, "category": one of ${JSON.stringify(CATEGORIES.map((c) => c.slug))} or null, "platform_tags": array using only values from ${JSON.stringify(PLATFORMS.map((p) => p.slug))}, "hype_signal": integer 0-100 or null, "game_label": string|null}`;
}

export function toJsonModePrompt(basePrompt: string): string {
  return `${basePrompt}\n\n${buildCardShapeInstructions()}`;
}

export function truncateToWordLimit(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

export function isValidCategory(value: unknown): value is CategorySlug {
  return CATEGORIES.some((c) => c.slug === value);
}

export function sanitizePlatformTags(value: unknown): PlatformSlug[] {
  if (!Array.isArray(value)) return [];
  return value.filter((p): p is PlatformSlug => PLATFORMS.some((platform) => platform.slug === p));
}
