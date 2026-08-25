import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { getAllCards } from "@/lib/cards";
import { getPlatform, PLATFORMS } from "@/lib/platforms";

export const revalidate = 7200;

type Props = { params: Promise<{ platform: string }> };

export function generateStaticParams() {
  return PLATFORMS.map((p) => ({ platform: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { platform } = await params;
  const info = getPlatform(platform);
  if (!info) return {};

  return {
    title: `${info.label} News`,
    description: `Latest ${info.label} video game news, releases, and reviews, summarized in 60 words.`,
  };
}

export default async function PlatformPage({ params }: Props) {
  const { platform } = await params;
  const info = getPlatform(platform);
  if (!info) notFound();

  const cards = getAllCards().filter((c) => c.platform_tags.includes(info.slug));

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-foreground">{info.label} News</h1>
      <FilterableCardGrid cards={cards} showCategoryTabs showPlatformFilter={false} />
    </div>
  );
}
