import Anthropic from "@anthropic-ai/sdk";
import { CARD_JSON_SCHEMA, CARD_TOOL_DESCRIPTION, CARD_TOOL_NAME } from "../card-schema";
import type { ModelProvider } from "./types";

// Fast/cheap model — this is a high-volume, low-complexity structured
// summarization task run every 2 hours, not something that needs a
// frontier model's reasoning depth.
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const CARD_TOOL: Anthropic.Tool = {
  name: CARD_TOOL_NAME,
  description: CARD_TOOL_DESCRIPTION,
  // Anthropic's `input_schema` is plain JSON Schema — same object shape
  // OpenAI/OpenRouter wrap under `function.parameters`.
  input_schema: CARD_JSON_SCHEMA as unknown as Anthropic.Tool.InputSchema,
};

export const anthropicProvider: ModelProvider = {
  name: "Anthropic",
  async callForCard(prompt) {
    const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

    let message: Anthropic.Message;
    try {
      message = await getClient().messages.create({
        model,
        // The full card JSON (a 60-word summary plus a handful of short
        // fields) never comes close to needing 1024 tokens — kept low so a
        // low OpenRouter/Anthropic balance doesn't reject the request over
        // budget reserved for a response this short never actually uses.
        max_tokens: 600,
        tools: [CARD_TOOL],
        tool_choice: { type: "tool", name: CARD_TOOL_NAME },
        messages: [{ role: "user", content: prompt }],
      });
    } catch (err) {
      console.error("  ! Anthropic API error:", err);
      return null;
    }

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    if (!toolUse) return null;

    return toolUse.input as Record<string, unknown>;
  },
};
