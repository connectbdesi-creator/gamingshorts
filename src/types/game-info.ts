/**
 * Best-effort game metadata from RAWG (scripts/ingest/game-info.ts),
 * cached in data/games.json. Every field beyond slug/name/fetched_at is
 * nullable/possibly-empty — RAWG's coverage varies a lot by title, and a
 * missing field here is normal, not an error.
 */
export interface GameInfo {
  slug: string;
  name: string;
  description: string | null;
  background_image: string | null;
  released: string | null;
  developers: string[];
  publishers: string[];
  genres: string[];
  platforms: string[];
  screenshots: string[];
  stores: { name: string; url: string }[];
  fetched_at: string;
}
