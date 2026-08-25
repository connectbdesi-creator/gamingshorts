import { Flame, MessageCircle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CategoryBadge } from "@/components/cards/category-badge";
import { LikeButton } from "@/components/engagement/like-button";
import { GameBadge } from "@/components/games/game-badge";
import { ShareMenu } from "@/components/share/share-menu";
import { formatRelativeTime } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Card } from "@/types/card";

export function NewsCard({
  card,
  className,
  onOpen,
  priority = false,
}: {
  card: Card;
  className?: string;
  /** When provided, opens the full-screen swipe reader instead of navigating. */
  onOpen?: (card: Card) => void;
  /** Eagerly loads this card's image instead of lazy-loading it — only the
   * first few above-the-fold cards should set this. */
  priority?: boolean;
}) {
  return (
    <article
      className={cn(
        "group mb-4 break-inside-avoid overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-accent/50",
        className
      )}
    >
      <Link
        href={`/news/${card.slug}`}
        onClick={
          onOpen
            ? (e) => {
                e.preventDefault();
                onOpen(card);
              }
            : undefined
        }
        className="block"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-background-elevated">
          <Image
            src={card.image_url}
            alt={card.headline}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            priority={priority}
          />
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <CategoryBadge category={card.category} />
          </div>
          {card.hype_signal !== null && card.hype_signal >= 80 && (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-chip bg-black/60 px-2 py-1 text-xs font-semibold text-orange-300 backdrop-blur">
              <Flame className="size-3.5" />
              {card.hype_signal}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 px-4 pt-4">
          <h2 className="line-clamp-3 text-base font-semibold leading-snug text-foreground">
            {card.headline}
          </h2>
          <p className="line-clamp-3 text-sm leading-relaxed text-foreground-muted">
            {card.summary}
          </p>
          <span className="truncate text-xs text-foreground-subtle">
            {card.source_name} · {formatRelativeTime(card.published_at)}
          </span>
        </div>
      </Link>

      {card.game && card.game_label && (
        <div className="px-4 pt-2">
          <GameBadge slug={card.game} label={card.game_label} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-4 py-3 text-foreground-subtle">
        <div className="flex items-center gap-3">
          <LikeButton cardId={card.id} initialCount={card.like_count} size="sm" />
          <span className="flex items-center gap-1 text-xs">
            <MessageCircle className="size-3.5" />
            {card.comment_count}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={card.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-accent hover:text-accent-hover"
          >
            Read full story →
          </a>
          <ShareMenu url={`${getSiteUrl()}/news/${card.slug}`} title={card.headline} />
        </div>
      </div>
    </article>
  );
}
