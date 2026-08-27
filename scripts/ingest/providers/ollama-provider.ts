import { toJsonModePrompt } from "../card-schema";
import type { ModelProvider } from "./types";

const DEFAULT_MODEL = "llama3.2:3b";
const DEFAULT_HOST = "http://localhost:11434";
// Started at 90s ("generous, so a slow-but-working generation isn't
// mistaken for dead") but that let one bad shard burn most of its whole
// time budget on a handful of calls when Ollama got inconsistently slow on
// a CI runner (observed: a same-sized sibling shard finished in 2 seconds
// while this one was still going after 14 minutes). 45s still comfortably
// covers a normal, healthy generation with NUM_PREDICT capping output
// length below — failing faster to rule-based here is what makes
// lib/classify.ts's own shard-level deadline actually effective, not just
// a backstop that never gets a chance to matter.
const REQUEST_TIMEOUT_MS = 45_000;
// A full card response (status/reason/headline/60-word summary/category/
// platform_tags/hype_signal/game_label as JSON) never realistically needs
// more than ~200 tokens — capping generation here is the single biggest
// per-call speed lever available: without it, a small local model can
// keep generating (rambling, retrying its own JSON, or padding) well past
// what the response actually needs, and CI has been paying for every one
// of those extra tokens serially. 256 leaves headroom over a bare 200-word
// estimate for JSON punctuation and a full platform_tags array without
// being unbounded.
const NUM_PREDICT = 256;

/** Raw call to Ollama's /api/generate in JSON mode. */
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
        options: { num_predict: NUM_PREDICT },
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
