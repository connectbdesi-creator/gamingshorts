import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { PLATFORMS, type PlatformSlug } from "@/lib/platforms";
import { MAX_SUMMARY_WORDS, countWords } from "@/types/card";

// Fast/cheap model — this is a high-volume, low-complexity structured
// summarization task run every 2 hours, not something that needs a
// frontier model's reasoning depth.
const MODEL = "claude-haiku-4-5-20251001";

const MAX_ATTEMPTS = 2;

export interface SummarizedArticle {
  headline: string;
  summary: string;
  category: CategorySlug;
  platform_tags: PlatformSlug[];
  hype_signal: number | null;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const CARD_TOOL: Anthropic.Tool = {
  name: "emit_card",
  description: "Emit a structured video game news card summarizing the given article.",
  input_schema: {
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
    },
    required: ["headline", "summary", "category", "platform_tags", "hype_signal"],
  },
};

function truncateToWordLimit(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

function buildPrompt(
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
  let feedback: string | undefined;
  let lastResult: SummarizedArticle | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let message: Anthropic.Message;
    try {
      message = await getClient().messages.create({
        model: MODEL,
        max_tokens: 1024,
        tools: [CARD_TOOL],
        tool_choice: { type: "tool", name: "emit_card" },
        messages: [{ role: "user", content: buildPrompt(article, feedback) }],
      });
    } catch (err) {
      console.error(`  ! Claude API error summarizing "${article.title}":`, err);
      return lastResult; // fall back to a prior (over-limit) attempt if we have one
    }

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) return lastResult;

    const input = toolUse.input as SummarizedArticle;

    if (!CATEGORIES.some((c) => c.slug === input.category)) {
      console.error(`  ! Invalid category "${input.category}" for "${article.title}", skipping`);
      return null;
    }
    input.platform_tags = (input.platform_tags ?? []).filter((p) =>
      PLATFORMS.some((platform) => platform.slug === p)
    );

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
