import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryBadge } from "@/components/cards/category-badge";
import { RelativeTime } from "@/components/format/relative-time";
import { FallbackImage } from "@/components/media/fallback-image";
import { getAllCards } from "@/lib/cards";
import { formatSourceNames } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";

// Same cadence as every other card-derived page — this is a static export
// per slug (generateStaticParams below), refreshed on the same 2-hour
// ingestion rebuild.
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

  return {
    title: card.headline,
    description: card.summary,
    // Embed pages are meant to be iframed everywhere — not something a
    // search engine should index and rank as if it were the real article
    // page, which already exists at /news/[slug].
    robots: { index: false, follow: false },
  };
}

/**
 * Minimal, iframe-friendly single-card view (CLAUDE.md's "embeddable card
 * widget for other sites to embed — drives backlinks"). No site chrome
 * (see components/layout/site-chrome.tsx) — just the card and a "Powered
 * by GameShorts" link back to the real article, which is the whole point:
 * every embed is a backlink. Get the embed snippet from the EmbedButton on
 * the article's own /news/[slug] page.
 */
export default async function EmbedCardPage({ params }: Props) {
  const { slug } = await params;
  const card = getCard(slug);
  if (!card) notFound();

  const articleUrl = `${getSiteUrl()}/news/${card.slug}`;

  return (
    <div className="flex h-full min-h-screen flex-col bg-background p-3 text-foreground">
      <a
        href={articleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-accent/50"
      >
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-background-elevated">
          <FallbackImage src={card.image_url} alt={card.headline} fill sizes="400px" className="object-cover" />
          <div className="absolute left-2 top-2">
            <CategoryBadge category={card.category} />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          <h1 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{card.headline}</h1>
          <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-foreground-muted">{card.summary}</p>
          <span className="text-[11px] text-foreground-subtle">
            {formatSourceNames(card.sources)} · <RelativeTime dateStr={card.published_at} />
          </span>
        </div>
      </a>
      <a
        href={getSiteUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 shrink-0 text-center text-[11px] font-medium text-foreground-subtle hover:text-accent"
      >
        Powered by GameShorts
      </a>
    </div>
  );
}
