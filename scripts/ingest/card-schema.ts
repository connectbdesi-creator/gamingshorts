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

const SYSTEM_PREAMBLE = `Classify the article below for a video game news site, status:
- "publish": substantively about video games (release, review, patch, esports, industry/business, or a game deal).
- "skip": clearly not gaming news (movies, TV, comics, celebrity), even from a gaming outlet, even if a game is mentioned in passing.
- "needs_review": gaming-adjacent but sensitive (arrests, harassment, protests, NSFW/leaked content, real-world violence), or genuinely ambiguous.

If "publish": fill in headline, summary, category, platform_tags, hype_signal, game_label. Else: set reason, leave those null/empty.

game_label: the one specific game this is about (null if not game-specific). Keep the full distinguishing title — never drop a number/prefix ("1666: Amsterdam" not "Amsterdam"; "The Witcher 4" not "The Witcher" — a shortened name can mean a different game). Same full title for the same game across articles, including remasters ("The Witcher 3: Wild Hunt" always, never "Witcher 3 Remastered") — but a real sequel/spin-off ("Elden Ring Nightreign" vs "Elden Ring") keeps its own label.`;

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
    .map((a, i) => `${i + 1}. Source: ${a.sourceName}\nHeadline: ${a.title}\n${a.content}`)
    .join("\n\n");

  return `These ${articles.length} articles cover the same video game story from different outlets — already confirmed as legitimate, on-topic, non-sensitive gaming news, so always report status "publish" with reason null.

${articlesBlock}

Write ONE combined card: a rewritten headline and a ${MAX_SUMMARY_WORDS}-word-or-fewer summary covering the story itself, not one outlet's angle — plus the best category, platform tags, hype signal, and game_label.${feedback ? `\n\n${feedback}` : ""}`;
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
