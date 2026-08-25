import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { PLATFORMS, type PlatformSlug } from "@/lib/platforms";
import { MAX_SUMMARY_WORDS } from "@/types/card";

export const CARD_TOOL_NAME = "emit_card";
export const CARD_TOOL_DESCRIPTION =
  "Emit a structured video game news card summarizing the given article.";

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
 * Plain JSON Schema for the card tool's arguments — shared across
 * providers since Anthropic's `input_schema` and OpenAI/OpenRouter's
 * `function.parameters` are both just JSON Schema underneath, only the
 * outer wrapper shape differs (see providers/*.ts).
 */
export const CARD_JSON_SCHEMA = {
  type: "object",
  properties: {
    is_gaming_news: {
      type: "boolean",
      description:
        "True only if the article is substantively about video games, game studios, publishers, platforms, esports, or the video game business. Articles about movies, TV shows, comics, general pop culture, or celebrity news are NOT gaming news, even if published by a gaming outlet or if they mention a game in passing.",
    },
    is_sensitive: {
      type: "boolean",
      description:
        "True if the article involves NSFW/explicit leaked content, real-world violence, arrests, protests, or other content inappropriate for a general gaming news audience — even if it's otherwise on-topic gaming news.",
    },
    skip_reason: {
      type: ["string", "null"],
      description:
        "A short reason (a few words) for why is_gaming_news is false or is_sensitive is true, for QC logging — e.g. \"movie news, not gaming\" or \"NSFW leaked content\". Null when both flags are clean (is_gaming_news true, is_sensitive false).",
    },
    headline: {
      type: "string",
      description: "Rewritten headline in your own words — do not copy the source's title verbatim.",
    },
    summary: {
      type: "string",
      description: `A rewritten, standalone summary in your own words, ${MAX_SUMMARY_WORDS} words or fewer. Never copy sentences verbatim from the source article — this must be an original paraphrase.`,
    },
    category: {
      type: "string",
      enum: CATEGORIES.map((c) => c.slug),
      description: "The single best-fitting category for this article.",
    },
    platform_tags: {
      type: "array",
      items: { type: "string", enum: PLATFORMS.map((p) => p.slug) },
      description:
        "Platforms this news concerns. Empty array for news that isn't platform-specific (e.g. business/industry stories).",
    },
    hype_signal: {
      type: ["integer", "null"],
      description:
        "0-100 estimate of how exciting/important this is to a gaming audience. Use null when a hype score wouldn't be meaningful for this kind of story (e.g. routine patch notes, procedural business news).",
    },
    game_label: {
      type: ["string", "null"],
      description:
        "The display name of the single specific game this article is primarily about, e.g. \"Elden Ring\" or \"VALORANT\" — used so readers can follow that game and get notified of future news about it. Use null for stories not about one specific game (industry/business news, storewide sales, multi-game roundups). Use the game's most common short name, not a version-specific subtitle unless that's how it's actually branded (e.g. \"Overwatch 2\", not \"Overwatch\").",
    },
  },
  required: [
    "is_gaming_news",
    "is_sensitive",
    "skip_reason",
    "headline",
    "summary",
    "category",
    "platform_tags",
    "hype_signal",
    "game_label",
  ],
} as const;

const SYSTEM_PREAMBLE = `You are filtering and summarizing articles for a video game industry news site. First classify the article using is_gaming_news and is_sensitive (see their descriptions). If is_gaming_news is false, or is_sensitive is true, set skip_reason to a short explanation and fill the remaining fields with your best guess anyway — they'll be discarded, only the flags and reason matter. Otherwise set skip_reason to null and summarize it as a video game news card for a 60-word Inshorts-style feed.`;

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
 * underlying story (see dedup.ts's isSameStory) into a single card. Reuses
 * CARD_JSON_SCHEMA/CARD_TOOL as-is rather than a separate tool definition —
 * every provider's tool is fixed at module scope (see providers/*.ts), and
 * the merge output is just a subset of the same card fields, so a second
 * tool isn't worth the added plumbing. is_gaming_news/is_sensitive are
 * explicitly told to pass clean since every contributing article already
 * individually cleared classification.
 */
export function buildMergePrompt(
  articles: { title: string; content: string; sourceName: string }[],
  feedback?: string
): string {
  const articlesBlock = articles
    .map((a, i) => `${i + 1}. Source: ${a.sourceName}\nHeadline: ${a.title}\n${a.content.slice(0, 1000)}`)
    .join("\n\n");

  return `The following ${articles.length} articles all cover the same underlying video game news story from different outlets — every one has already been individually confirmed as legitimate, on-topic, non-sensitive gaming news, so set is_gaming_news to true, is_sensitive to false, and skip_reason to null.

${articlesBlock}

Write ONE combined card for this story: a single rewritten headline and a ${MAX_SUMMARY_WORDS}-word-or-fewer summary covering the story itself — not any one outlet's specific angle — plus the single best category, platform tags, hype signal, and game label for it.${feedback ? `\n\n${feedback}` : ""}`;
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
