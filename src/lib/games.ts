import { isWithinHours } from "@/lib/format";
import type { Card } from "@/types/card";

export interface GameEntry {
  slug: string;
  label: string;
  cardCount: number;
  last24hCount: number;
  latestPublishedAt: string;
}

/**
 * There's no fixed game registry (unlike the 6 categories/6 platforms) —
 * which games exist is entirely a function of what's in the current card
 * set, so it's derived here rather than hardcoded.
 */
export function getGameIndex(cards: Card[]): GameEntry[] {
  const bySlug = new Map<string, GameEntry>();

  for (const card of cards) {
    if (!card.game || !card.game_label) continue;

    const fresh = isWithinHours(card.published_at, 24);
    const publishedMs = new Date(card.published_at).getTime();
    const existing = bySlug.get(card.game);

    if (existing) {
      existing.cardCount++;
      if (fresh) existing.last24hCount++;
      if (publishedMs > new Date(existing.latestPublishedAt).getTime()) {
        existing.latestPublishedAt = card.published_at;
      }
    } else {
      bySlug.set(card.game, {
        slug: card.game,
        label: card.game_label,
        cardCount: 1,
        last24hCount: fresh ? 1 : 0,
        latestPublishedAt: card.published_at,
      });
    }
  }

  return Array.from(bySlug.values());
}

export function getGame(cards: Card[], slug: string): GameEntry | undefined {
  return getGameIndex(cards).find((g) => g.slug === slug);
}

/** Top N games by article volume in the last 24h, for the header's dynamic row. */
export function getTrendingGames(cards: Card[], limit = 5): GameEntry[] {
  return getGameIndex(cards)
    .filter((g) => g.last24hCount > 0)
    .sort((a, b) => b.last24hCount - a.last24hCount || b.cardCount - a.cardCount)
    .slice(0, limit);
}

/** Top N games by total article volume (all-time within the current card
 * set, not just the last 24h), for the "By Games" filter dropdown. */
export function getTopGamesByVolume(cards: Card[], limit = 10): GameEntry[] {
  return getGameIndex(cards)
    .sort((a, b) => b.cardCount - a.cardCount)
    .slice(0, limit);
}
