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
  required: ["headline", "summary", "category", "platform_tags", "hype_signal", "game_label"],
} as const;

export function buildPrompt(
  article: { title: string; content: string; sourceName: string },
  feedback?: string
): string {
  return `Source outlet: ${article.sourceName}
Original headline: ${article.title}

Article content:
"""
${article.content}
"""

Summarize this as a video game news card for a 60-word Inshorts-style feed. Rewrite everything in your own words — do not copy sentences from the article. The summary must be ${MAX_SUMMARY_WORDS} words or fewer, no exceptions.${feedback ? `\n\n${feedback}` : ""}`;
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
