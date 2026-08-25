import { NewsCard } from "@/components/cards/news-card";
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

  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {cards.map((card, index) => (
        // Only the first row-ish of cards should eagerly load/preload —
        // marking every card priority (as the reader used to) forces the
        // browser to fetch dozens of images up front instead of lazily as
        // the user scrolls, which hurts load time without helping LCP.
        <NewsCard key={card.id} card={card} onOpen={onOpen} priority={index < 4} />
      ))}
    </div>
  );
}
