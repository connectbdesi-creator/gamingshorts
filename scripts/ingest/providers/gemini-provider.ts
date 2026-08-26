import { toJsonModePrompt } from "../card-schema";
import type { ModelProvider } from "./types";

// gemini-2.0-flash was retired — this is its confirmed-current GA
// replacement (see scripts/fetch-updates.mjs for the same fix + why).
const DEFAULT_MODEL = "gemini-3.6-flash";

/**
 * No native tool-calling here (unlike the Anthropic/OpenRouter providers)
 * — plain JSON mode via response_mime_type, with the expected shape
 * spelled out in the prompt (see card-schema.ts's toJsonModePrompt).
 * Keeps this provider dependency-free (plain fetch, no Google SDK) and
 * avoids relying on Gemini's function-calling schema format, which isn't
 * worth the risk of a casing/format mismatch for a request this simple.
 */
export const geminiProvider: ModelProvider = {
  name: "Gemini",
  async callForCard(prompt) {
    const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: toJsonModePrompt(prompt) }] }],
          generationConfig: { response_mime_type: "application/json" },
        }),
      });
    } catch (err) {
      console.error("  ! Gemini network error:", (err as Error).message);
      return null;
    }

    if (!res.ok) {
      console.error(`  ! Gemini API error: HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("  ! Gemini response missing text content");
      return null;
    }

    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch (err) {
      console.error("  ! Gemini returned unparseable JSON:", (err as Error).message);
      return null;
    }
  },
};
