import OpenAI from "openai";
import { getSiteUrl } from "@/lib/site";
import { CARD_JSON_SCHEMA, CARD_TOOL_DESCRIPTION, CARD_TOOL_NAME } from "../card-schema";
import type { ModelProvider } from "./types";

// Routed through Anthropic on OpenRouter by default, matching the quality
// bar the native Anthropic provider targets — override with OPENROUTER_MODEL
// (e.g. a free/open-weight model) to cut cost. See openrouter.ai/models.
const DEFAULT_MODEL = "anthropic/claude-haiku-4.5";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        // Optional attribution headers OpenRouter uses for its public
        // leaderboard — harmless to omit, but free to include.
        "HTTP-Referer": getSiteUrl(),
        "X-Title": "GameShorts",
      },
    });
  }
  return client;
}

const CARD_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: CARD_TOOL_NAME,
    description: CARD_TOOL_DESCRIPTION,
    // Same JSON Schema object as the Anthropic provider, just wrapped
    // under `function.parameters` instead of `input_schema`.
    parameters: CARD_JSON_SCHEMA as unknown as Record<string, unknown>,
  },
};

export const openRouterProvider: ModelProvider = {
  name: "OpenRouter",
  async callForCard(prompt) {
    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await getClient().chat.completions.create({
        model,
        // The full card JSON (a 60-word summary plus a handful of short
        // fields) never comes close to needing 1024 tokens — kept low so a
        // low OpenRouter/Anthropic balance doesn't reject the request over
        // budget reserved for a response this short never actually uses.
        max_tokens: 600,
        tools: [CARD_TOOL],
        tool_choice: { type: "function", function: { name: CARD_TOOL_NAME } },
        messages: [{ role: "user", content: prompt }],
      });
    } catch (err) {
      console.error("  ! OpenRouter API error:", err);
      return null;
    }

    const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") return null;

    try {
      return JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
    } catch (err) {
      console.error("  ! OpenRouter returned unparseable tool arguments:", err);
      return null;
    }
  },
};
