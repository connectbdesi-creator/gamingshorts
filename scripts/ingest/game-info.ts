import type { GameInfo } from "@/types/game-info";

interface RawgGame {
  id: number;
  name: string;
  background_image?: string | null;
  released?: string | null;
  description_raw?: string | null;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  genres?: { name: string }[];
  platforms?: { platform: { name: string } }[];
}

interface RawgSearchResponse {
  results?: RawgGame[];
}

interface RawgScreenshotsResponse {
  results?: { image: string }[];
}

interface RawgStoresResponse {
  results?: { url: string; store: { name: string } }[];
}

const RAWG_BASE = "https://api.rawg.io/api";

const NAME_STOPWORDS = new Set(["the", "a", "an", "of", "and"]);

function significantWords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !NAME_STOPWORDS.has(w));
}

/**
 * RAWG's search is a fuzzy/relevance ranking, not an exact lookup — for a
 * short or generic query (a single word, a franchise name without its
 * number) the top hit is often a completely different, unrelated game
 * (e.g. searching "Amsterdam" for the article "1666: Amsterdam" top-matched
 * an unrelated game literally named "Hamsterdam"; "Lego Cities Skylines"
 * matched the base "Cities: Skylines", dropping "Lego" entirely). Requiring
 * every significant word of our query to appear in the candidate's actual
 * name — not just word-order/substring similarity — rejects those
 * mismatches; better to show no game panel than a wrong one.
 */
function namesLikelyMatch(query: string, candidateName: string): boolean {
  const queryWords = significantWords(query);
  if (queryWords.length === 0) return true;
  const candidateWords = new Set(significantWords(candidateName));
  return queryWords.every((w) => candidateWords.has(w));
}

async function rawgFetch<T>(path: string, apiKey: string): Promise<T | null> {
  const separator = path.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${RAWG_BASE}${path}${separator}key=${apiKey}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Best-effort game metadata lookup via RAWG (rawg.io/apidocs). Every field
 * is optional in the result — RAWG's coverage varies a lot by title, and
 * this project treats missing metadata as normal, not an error. Skipped
 * entirely (returns null) if RAWG_API_KEY isn't set, same graceful-degrade
 * contract as the rest of the ingestion pipeline.
 */
export async function fetchGameInfo(
  gameSlug: string,
  gameLabel: string
): Promise<GameInfo | null> {
  const apiKey = process.env.RAWG_API_KEY;
  if (!apiKey) return null;

  const search = await rawgFetch<RawgSearchResponse>(
    `/games?search=${encodeURIComponent(gameLabel)}&page_size=10`,
    apiKey
  );
  const match = search?.results?.find((r) => namesLikelyMatch(gameLabel, r.name));
  if (!match) return null;

  const [screenshots, stores] = await Promise.all([
    rawgFetch<RawgScreenshotsResponse>(`/games/${match.id}/screenshots`, apiKey),
    rawgFetch<RawgStoresResponse>(`/games/${match.id}/stores`, apiKey),
  ]);

  return {
    slug: gameSlug,
    name: match.name ?? gameLabel,
    description: match.description_raw ?? null,
    background_image: match.background_image ?? null,
    released: match.released ?? null,
    developers: (match.developers ?? []).map((d) => d.name).filter(Boolean),
    publishers: (match.publishers ?? []).map((p) => p.name).filter(Boolean),
    genres: (match.genres ?? []).map((g) => g.name).filter(Boolean),
    platforms: (match.platforms ?? []).map((p) => p.platform?.name).filter(Boolean) as string[],
    screenshots: (screenshots?.results ?? []).map((s) => s.image).slice(0, 8),
    stores: (stores?.results ?? [])
      .filter((s) => s.store?.name && s.url)
      .map((s) => ({ name: s.store.name, url: s.url })),
    fetched_at: new Date().toISOString(),
  };
}
