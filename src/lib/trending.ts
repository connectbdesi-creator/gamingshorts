import type { Card } from "@/types/card";

/**
 * Interim trending heuristic: highest hype_signal first (cards with no
 * signal sort last), recency as the tiebreaker. CLAUDE.md's Open Items
 * still lists the full scoring algorithm (source quality + recency +
 * keyword signals + discussion velocity) as undecided — this is
 * deliberately simple until that's designed for real.
 */
export function getTrendingCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const hypeDiff = (b.hype_signal ?? -1) - (a.hype_signal ?? -1);
    if (hypeDiff !== 0) return hypeDiff;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
}
