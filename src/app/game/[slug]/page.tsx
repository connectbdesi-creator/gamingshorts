import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FilterableCardGrid } from "@/components/cards/filterable-card-grid";
import { FollowButton } from "@/components/engagement/follow-button";
import { NotificationToggle } from "@/components/engagement/notification-toggle";
import { GameInfoPanel } from "@/components/games/game-info-panel";
import { getAllCards } from "@/lib/cards";
import { getGameInfo } from "@/lib/game-info";
import { getGame, getGameIndex } from "@/lib/games";
import { getSiteUrl } from "@/lib/site";

export const revalidate = 7200;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getGameIndex(getAllCards()).map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = getGame(getAllCards(), slug);
  if (!game) return {};

  const description = `All ${game.label} news, summarized in 60 words, updated every 2 hours.`;

  return {
    title: game.label,
    description,
    alternates: { canonical: `${getSiteUrl()}/game/${slug}` },
    openGraph: { type: "website", title: game.label, description },
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const allCards = getAllCards();
  const game = getGame(allCards, slug);
  if (!game) notFound();

  const cards = allCards.filter((c) => c.game === slug);
  const info = getGameInfo(slug);
  const url = `${getSiteUrl()}/game/${slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: `${game.label} news`,
        description: `All ${game.label} news, summarized in 60 words.`,
        url,
        ...(info?.background_image ? { image: info.background_image } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: getSiteUrl() },
          { "@type": "ListItem", position: 2, name: game.label, item: url },
        ],
      },
      ...(info
        ? [
            {
              "@type": "VideoGame",
              name: info.name,
              description: info.description ?? undefined,
              image: info.background_image ?? undefined,
              datePublished: info.released ?? undefined,
              genre: info.genres.length > 0 ? info.genres : undefined,
              publisher: info.publishers.map((name) => ({
                "@type": "Organization",
                name,
              })),
              author: info.developers.map((name) => ({
                "@type": "Organization",
                name,
              })),
              gamePlatform: info.platforms.length > 0 ? info.platforms : undefined,
            },
          ]
        : []),
    ],
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

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

      {info && <GameInfoPanel info={info} />}

      <FilterableCardGrid cards={cards} showPlatformFilter={false} />
    </div>
  );
}
