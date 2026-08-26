import { toJsonModePrompt } from "../card-schema";
import type { ModelProvider } from "./types";

const DEFAULT_MODEL = "llama3.2:3b";
const DEFAULT_HOST = "http://localhost:11434";
// Local inference on a CPU CI runner is much slower than a hosted API —
// generous timeout so a slow-but-working generation isn't mistaken for a
// dead server and sent through the rule-based fallback unnecessarily.
const REQUEST_TIMEOUT_MS = 90_000;

/**
 * Raw call to Ollama's /api/generate in JSON mode — shared by the card
 * provider below and by dedup.ts's cluster-confirmation call, which needs
 * its own (differently-shaped) prompt rather than the card shape.
 */
export async function callOllamaJson(prompt: string): Promise<Record<string, unknown> | null> {
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const host = process.env.OLLAMA_HOST || DEFAULT_HOST;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        format: "json",
        stream: false,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("  ! Ollama request failed:", (err as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    console.error(`  ! Ollama API error: HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }

  const data = await res.json();
  const text = data?.response;
  if (!text) {
    console.error("  ! Ollama response missing text content");
    return null;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    console.error("  ! Ollama returned unparseable JSON:", (err as Error).message);
    return null;
  }
}

/**
 * No native tool-calling here — plain JSON mode via /api/generate's
 * format:"json", with the expected shape spelled out in the prompt (see
 * card-schema.ts's toJsonModePrompt). Runs against a local Ollama instance
 * (installed + started by the GitHub Actions workflow, or run yourself
 * locally via `ollama serve`) — no API key, no billing, no rate limit.
 */
export const ollamaProvider: ModelProvider = {
  name: "Ollama",
  callForCard(prompt) {
    return callOllamaJson(toJsonModePrompt(prompt));
  },
};
