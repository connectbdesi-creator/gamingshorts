import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { getAllCards } from "@/lib/cards";
import { pageAlternates } from "@/lib/site";
import { getTrendingCards } from "@/lib/trending";

export const revalidate = 7200;

export const metadata: Metadata = {
  title: "Trending",
  description: "The biggest video game news right now, ranked by hype and recency.",
  alternates: pageAlternates("/trending"),
};

export default function TrendingPage() {
  const cards = getTrendingCards(getAllCards());

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">Trending</h1>
      <FilterableCardGrid cards={cards} showCategoryTabs />
    </div>
  );
}
