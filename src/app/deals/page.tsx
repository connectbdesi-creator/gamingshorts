import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { getAffiliateStoreLinks } from "@/lib/affiliate";
import { getAllCards } from "@/lib/cards";
import { pageAlternates } from "@/lib/site";

// Phase 6 adds the Steam price-data ingestion (a real per-game deal feed)
// and the "Sponsored" native ad card variant now lives in
// src/components/cards/sponsored-card.tsx / src/lib/sponsors.ts.
export const revalidate = 7200;

export const metadata: Metadata = {
  title: "Deals & Sales",
  description:
    "The best current video game deals and sales across Steam, Epic, PSN, and Xbox, updated automatically.",
  alternates: pageAlternates("/deals"),
};

export default function DealsPage() {
  const cards = getAllCards().filter((c) => c.category === "deals");
  const storeLinks = getAffiliateStoreLinks();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">Deals & Sales</h1>

      {storeLinks.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Shop deals
          </span>
          {storeLinks.map((store) => (
            <a
              key={store.name}
              href={store.url}
              target="_blank"
              rel="noopener sponsored"
              className="inline-flex items-center gap-1 rounded-chip border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {store.name}
              <ExternalLink className="size-3" />
            </a>
          ))}
        </div>
      )}

      <FilterableCardGrid cards={cards} showPlatformFilter={false} />
    </div>
  );
}
