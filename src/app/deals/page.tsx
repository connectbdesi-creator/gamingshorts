import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { getAllCards } from "@/lib/cards";

// Phase 6 adds the Steam price-data ingestion + affiliate link fields and
// the "Sponsored" native ad card variant, both landing on this route.
export const revalidate = 7200;

export const metadata: Metadata = {
  title: "Deals & Sales",
  description:
    "The best current video game deals and sales across Steam, Epic, PSN, and Xbox, updated automatically.",
};

export default function DealsPage() {
  const cards = getAllCards().filter((c) => c.category === "deals");

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">Deals & Sales</h1>
      <FilterableCardGrid cards={cards} showPlatformFilter={false} />
    </div>
  );
}
