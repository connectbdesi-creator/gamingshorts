import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { getAllCards } from "@/lib/cards";
import { getHotTopics } from "@/lib/hot-topics";
import { pageAlternates } from "@/lib/site";

export const revalidate = 7200;

export const metadata: Metadata = {
  title: "Hot Topics",
  description:
    "The video game stories generating the most likes and discussion right now — jump in and join the conversation.",
  alternates: pageAlternates("/hot-topics"),
};

export default function HotTopicsPage() {
  const cards = getHotTopics(getAllCards());

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-foreground">Hot Topics</h1>
      <p className="mb-4 text-sm text-foreground-subtle">
        Stories with the most likes and comments — see what everyone&apos;s
        talking about and join in.
      </p>
      <FilterableCardGrid cards={cards} showCategoryTabs />
    </div>
  );
}
