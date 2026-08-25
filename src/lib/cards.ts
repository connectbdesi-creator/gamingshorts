import fs from "node:fs";
import path from "node:path";
import { MOCK_CARDS } from "@/lib/mock-cards";
import type { Card } from "@/types/card";

const CARDS_JSON_PATH = path.join(process.cwd(), "data", "cards.json");

let cache: Card[] | null = null;

/**
 * Cards for every page/route to render. Reads the Phase 5 ingestion
 * pipeline's output (data/cards.json, committed by the GitHub Actions cron)
 * if it exists; falls back to the Phase 2 mock dataset otherwise, so a
 * fresh clone or a repo that hasn't run ingestion yet still builds and
 * renders a full site instead of an empty one.
 *
 * Reads happen at build/request time in Server Components only — this
 * touches the filesystem, so never import it from a Client Component.
 *
 * Always returned newest-first by published_at. The ingestion pipeline
 * already writes data/cards.json in that order, but sorting again here
 * guarantees it for every consumer regardless of source (including the
 * mock-data fallback) rather than relying on each caller to get it right.
 */
export function getAllCards(): Card[] {
  if (cache) return cache;

  let cards = MOCK_CARDS;
  try {
    const raw = fs.readFileSync(CARDS_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as Card[];
    if (Array.isArray(parsed) && parsed.length > 0) cards = parsed;
  } catch {
    // data/cards.json doesn't exist yet (ingestion has never run) or is
    // malformed — fall through to mock data.
  }

  cache = [...cards].sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
  return cache;
}
