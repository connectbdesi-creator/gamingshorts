import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { getAllCards } from "@/lib/cards";

// Cards come from data/cards.json (Phase 5 ingestion output), rebuilt on
// every push the cron workflow makes, with ISR as a same-build safety net.
export const revalidate = 7200;

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-10">
      <div className="rounded-card border border-border bg-surface p-4 shadow-lg sm:p-6">
        <FilterableCardGrid cards={getAllCards()} showCategoryTabs />
      </div>
    </div>
  );
}
