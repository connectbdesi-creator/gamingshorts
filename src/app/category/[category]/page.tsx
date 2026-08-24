import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { getAllCards } from "@/lib/cards";

export const revalidate = 7200;

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const info = getCategory(category);
  if (!info) return {};

  return {
    title: info.label,
    description: `Latest ${info.label.toLowerCase()} news from the video game industry, summarized in 60 words.`,
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const info = getCategory(category);
  if (!info) notFound();

  const cards = getAllCards().filter((c) => c.category === category);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">{info.label}</h1>
      <FilterableCardGrid cards={cards} />
    </div>
  );
}
