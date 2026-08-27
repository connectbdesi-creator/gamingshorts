import { rankByImportance, TRENDING_WEIGHTS } from "@/lib/scoring";
import type { Card } from "@/types/card";

/** Ranks by the shared importance score (src/lib/scoring.ts), weighted
 * toward recency + hype — "what's significant right now". */
export function getTrendingCards(cards: Card[]): Card[] {
  return rankByImportance(cards, TRENDING_WEIGHTS);
}
