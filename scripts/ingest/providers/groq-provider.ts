import OpenAI from "openai";
import { toJsonModePrompt } from "../card-schema";
import type { ModelProvider } from "./types";

// llama-3.3-70b-versatile still exists on Groq but moved to Enterprise/
// contact-sales pricing — a standard key gets a 404 on it (confirmed via
// console.groq.com/docs/models; see scripts/fetch-updates.mjs for the
// same fix). gpt-oss-120b is on Groq's standard self-serve pricing.
const DEFAULT_MODEL = "openai/gpt-oss-120b";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return client;
}

/** Same JSON-mode approach as the Gemini provider — no native tool-calling
 * schema, the expected shape is spelled out in the prompt text instead. */
export const groqProvider: ModelProvider = {
  name: "Groq",
  async callForCard(prompt) {
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

    let completion: OpenAI.Chat.Completions.ChatCompletion;
    try {
      completion = await getClient().chat.completions.create({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Respond with only a single valid JSON object. No markdown, no commentary, no code fences.",
          },
          { role: "user", content: toJsonModePrompt(prompt) },
        ],
      });
    } catch (err) {
      console.error("  ! Groq API error:", (err as Error).message);
      return null;
    }

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      console.error("  ! Groq response missing message content");
      return null;
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      console.error("  ! Groq returned unparseable JSON:", (err as Error).message);
      return null;
    }
  },
};
