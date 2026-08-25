import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { FollowButton } from "@/components/engagement/follow-button";
import { NotificationToggle } from "@/components/engagement/notification-toggle";
import { getAllCards } from "@/lib/cards";
import { getGame, getGameIndex } from "@/lib/games";

export const revalidate = 7200;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getGameIndex(getAllCards()).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(getAllCards(), slug);
  if (!game) return {};

  return {
    title: game.label,
    description: `All ${game.label} news, summarized in 60 words, updated every 2 hours.`,
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const allCards = getAllCards();
  const game = getGame(allCards, slug);
  if (!game) notFound();

  const cards = allCards.filter((c) => c.game === slug);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{game.label}</h1>
          <p className="text-sm text-foreground-subtle">
            {game.cardCount} {game.cardCount === 1 ? "story" : "stories"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FollowButton gameSlug={game.slug} />
          <NotificationToggle />
        </div>
      </div>
      <FilterableCardGrid cards={cards} />
    </div>
  );
}
