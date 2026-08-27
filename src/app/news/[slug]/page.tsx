import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/cards/category-badge";
import { PlatformChip } from "@/components/cards/platform-chip";
import { CommentCountBadge } from "@/components/comments/comment-count-badge";
import { Comments } from "@/components/comments/comments";
import { FollowButton } from "@/components/engagement/follow-button";
import { LikeButton } from "@/components/engagement/like-button";
import { RelativeTime } from "@/components/format/relative-time";
import { GameBadge } from "@/components/games/game-badge";
import { FallbackImage } from "@/components/media/fallback-image";
import { ArticleReaderLauncher } from "@/components/reader/article-reader-launcher";
import { EmbedButton } from "@/components/share/embed-button";
import { ShareButtons } from "@/components/share/share-buttons";
import { getCategory } from "@/lib/categories";
import { getAllCards } from "@/lib/cards";
import { formatSourceNames } from "@/lib/format";
import { getSiteUrl, pageAlternates } from "@/lib/site";

// New cards get their own static page on the next rebuild the ingestion
// workflow triggers; this revalidate is a same-build content freshness
// safety net for pages that already exist.
export const revalidate = 7200;

type Props = { params: Promise<{ slug: string }> };

function getCard(slug: string) {
  return getAllCards().find((c) => c.slug === slug);
}

export function generateStaticParams() {
  return getAllCards().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) return {};

  const url = `${getSiteUrl()}/news/${card.slug}`;

  return {
    title: card.headline,
    description: card.summary,
    alternates: pageAlternates(`/news/${card.slug}`),
    openGraph: {
      type: "article",
      title: card.headline,
      description: card.summary,
      url,
      images: [{ url: card.image_url }],
      publishedTime: card.published_at,
    },
    twitter: {
      card: "summary_large_image",
      title: card.headline,
      description: card.summary,
      images: [card.image_url],
    },
  };
}

export default async function NewsCardPage({ params }: Props) {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) notFound();

  const allCards = getAllCards();
  const categoryInfo = getCategory(card.category);
  const cardIndex = allCards.findIndex((c) => c.id === card.id);
  const url = `${getSiteUrl()}/news/${card.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "NewsArticle",
        headline: card.headline,
        description: card.summary,
        image: [card.image_url],
        datePublished: card.published_at,
        dateModified: card.published_at,
        articleSection: categoryInfo?.label ?? card.category,
        keywords: [categoryInfo?.label, card.game_label, ...card.platform_tags]
          .filter(Boolean)
          .join(", "),
        isBasedOn: card.sources.map((s) => s.url),
        citation: card.sources.map((s) => s.url),
        author: { "@type": "Organization", name: "GameShorts" },
        publisher: {
          "@type": "Organization",
          name: "GameShorts",
          logo: { "@type": "ImageObject", url: `${getSiteUrl()}/favicon.ico` },
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: getSiteUrl() },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryInfo?.label ?? card.category,
            item: `${getSiteUrl()}/category/${card.category}`,
          },
          { "@type": "ListItem", position: 3, name: card.headline, item: url },
        ],
      },
    ],
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-card bg-background-elevated">
        <FallbackImage
          src={card.image_url}
          alt={card.headline}
          fill
          sizes="(min-width: 768px) 672px, 100vw"
          className="object-cover"
          priority
        />
        <div className="absolute left-3 top-3">
          <CategoryBadge category={card.category} />
        </div>
      </div>

      <h1 className="mt-5 text-2xl font-bold leading-snug text-foreground">
        {card.headline}
      </h1>

      {card.game && card.game_label && (
        <div className="mt-2 flex items-center gap-3">
          <GameBadge
            slug={card.game}
            label={card.game_label}
            className="text-sm font-semibold text-accent hover:text-accent-hover"
          />
          <FollowButton gameSlug={card.game} />
        </div>
      )}

      <p className="mt-2 text-sm text-foreground-subtle">
        {formatSourceNames(card.sources)} · <RelativeTime dateStr={card.published_at} />
      </p>

      <p className="mt-4 text-base leading-relaxed text-foreground-muted">
        {card.summary}
      </p>

      {card.platform_tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.platform_tags.map((p) => (
            <PlatformChip key={p} platform={p} />
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {card.sources.map((source) => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center rounded-chip bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
            >
              {card.sources.length > 1 ? `Read at ${source.name} →` : "Read full story →"}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <LikeButton cardId={card.id} initialCount={card.like_count} size="lg" />
          <a
            href="#comments"
            className="flex items-center gap-1.5 text-base font-medium text-foreground hover:text-accent"
          >
            <CommentCountBadge initialCount={card.comment_count} />
          </a>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 border-y border-border py-3">
        <ShareButtons url={url} title={card.headline} />
        <EmbedButton slug={card.slug} siteUrl={getSiteUrl()} />
      </div>

      <div className="mt-6">
        <ArticleReaderLauncher cards={allCards} startIndex={cardIndex} />
      </div>

      <div id="comments" className="mt-10 scroll-mt-28">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Comments</h2>
        <Comments term={card.slug} />
      </div>
    </div>
  );
}
