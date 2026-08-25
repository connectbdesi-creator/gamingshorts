import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { getAllCards } from "@/lib/cards";
import { isWithinHours } from "@/lib/format";
import { pageAlternates } from "@/lib/site";

// Cards come from data/cards.json (Phase 5 ingestion output), rebuilt on
// every push the cron workflow makes, with ISR as a same-build safety net.
export const revalidate = 7200;

export const metadata: Metadata = {
  alternates: pageAlternates("/"),
};

const FRESH_WINDOW_HOURS = 24;

export default function HomePage() {
  // Only the last 24h shows on the homepage — older cards aren't deleted,
  // they just stop appearing here. They're still fully reachable via their
  // own /news/[slug] page, their category page, and (most usefully) their
  // /game/[slug] page, which is unfiltered by design.
  const freshCards = getAllCards().filter((c) => isWithinHours(c.published_at, FRESH_WINDOW_HOURS));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <div className="rounded-card border border-border bg-surface p-4 shadow-lg sm:p-6">
        <h1 className="mb-4 text-center text-xl font-bold text-foreground">
          Latest Gaming News in Last 24 Hours
        </h1>
        <FilterableCardGrid cards={freshCards} showCategoryTabs />
      </div>
    </div>
  );
}
