import { NewsCard } from "@/components/cards/news-card";
import { SponsoredCard } from "@/components/cards/sponsored-card";
import { ACTIVE_SPONSORED_CARDS, SPONSORED_CARD_INTERVAL } from "@/lib/sponsors";
import type { Card } from "@/types/card";

export function CardGrid({
  cards,
  onOpen,
}: {
  cards: Card[];
  onOpen?: (card: Card) => void;
}) {
  if (cards.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-foreground-subtle">
        No cards yet — check back soon.
      </p>
    );
  }

  // Interleaves one sponsored card after every Nth organic card (CLAUDE.md's
  // native ad card requirement) — a no-op while ACTIVE_SPONSORED_CARDS is
  // empty (see src/lib/sponsors.ts), so the grid renders exactly as before
  // until a real sponsor is configured.
  const elements: React.ReactNode[] = [];
  let sponsorIndex = 0;
  cards.forEach((card, index) => {
    // Only the first row-ish of cards should eagerly load/preload —
    // marking every card priority (as the reader used to) forces the
    // browser to fetch dozens of images up front instead of lazily as
    // the user scrolls, which hurts load time without helping LCP.
    elements.push(<NewsCard key={card.id} card={card} onOpen={onOpen} priority={index < 4} />);

    const isIntervalPoint = (index + 1) % SPONSORED_CARD_INTERVAL === 0;
    if (isIntervalPoint && ACTIVE_SPONSORED_CARDS.length > 0) {
      const sponsor = ACTIVE_SPONSORED_CARDS[sponsorIndex % ACTIVE_SPONSORED_CARDS.length];
      elements.push(<SponsoredCard key={`sponsor-${sponsor.id}-${index}`} sponsor={sponsor} />);
      sponsorIndex++;
    }
  });

  return <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">{elements}</div>;
}
