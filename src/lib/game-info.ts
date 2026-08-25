import fs from "node:fs";
import path from "node:path";
import type { GameInfo } from "@/types/game-info";

const GAMES_JSON_PATH = path.join(process.cwd(), "data", "games.json");

let cache: GameInfo[] | null = null;

/**
 * RAWG-sourced game metadata (see scripts/ingest/game-info.ts), read the
 * same way as getAllCards() — from data/games.json if the ingestion
 * pipeline has ever populated it, falling back to an empty list otherwise
 * so /game/[slug] pages just skip the info panel instead of breaking.
 */
function getAllGameInfo(): GameInfo[] {
  if (cache) return cache;

  try {
    const raw = fs.readFileSync(GAMES_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as GameInfo[];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }

  return cache;
}

export function getGameInfo(slug: string): GameInfo | undefined {
  return getAllGameInfo().find((g) => g.slug === slug);
}
