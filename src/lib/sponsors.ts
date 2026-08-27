export interface SponsoredCardData {
  id: string;
  sponsor_name: string;
  headline: string;
  body: string;
  image_url: string;
  cta_label: string;
  cta_url: string;
}

/**
 * CLAUDE.md's "Native ad cards | Sponsored cards visually matching news
 * cards, clearly labeled 'Sponsored' | Day 1" — this is the activation
 * point. Empty by default (no live sponsor yet), so CardGrid's injection
 * (see components/cards/card-grid.tsx) is a no-op and the grid renders
 * exactly as before. Add a real entry here — or swap this for a
 * data/sponsors.json read, same pattern as data/games.json, if slots ever
 * need to be edited without a code deploy — once a sponsor signs on.
 */
export const ACTIVE_SPONSORED_CARDS: SponsoredCardData[] = [];

/** One sponsored card is injected after every N organic cards in the grid. */
export const SPONSORED_CARD_INTERVAL = 8;
