import { HOT_TOPICS_WEIGHTS, rankByImportance } from "@/lib/scoring";
import type { Card } from "@/types/card";

/** Ranks by the shared importance score (src/lib/scoring.ts), weighted
 * toward discussion/engagement — "what people are actually talking about",
 * not just what's newest. */
export function getHotTopics(cards: Card[]): Card[] {
  return rankByImportance(cards, HOT_TOPICS_WEIGHTS);
}
