"use client";

import { MessageCircle, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CategoryBadge } from "@/components/cards/category-badge";
import { PlatformChip } from "@/components/cards/platform-chip";
import { FollowButton } from "@/components/engagement/follow-button";
import { LikeButton } from "@/components/engagement/like-button";
import { GameBadge } from "@/components/games/game-badge";
import { ShareButtons } from "@/components/share/share-buttons";
import { formatRelativeTime } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";
import type { Card } from "@/types/card";

/**
 * Boxed (not edge-to-edge) Inshorts-style reader, rendered below the sticky
 * header (via the --header-h var, see header-height-observer.tsx) rather
 * than covering it, so the header/nav stays visible and usable on both
 * mobile and desktop while swiping. Vertical scroll-snap gives native
 * swipe-to-advance on touch/mouse-wheel, with arrow keys as a second
 * option. An IntersectionObserver reports the active card so the address
 * bar's slug stays in sync as the user swipes.
 */
export function SwipeReader({
  cards,
  initialIndex = 0,
  onClose,
  onIndexChange,
}: {
  cards: Card[];
  initialIndex?: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const lastReportedIndexRef = useRef(initialIndex);

  useEffect(() => {
    const el = trackRef.current?.children[initialIndex] as
      | HTMLElement
      | undefined;
    // Explicit "instant" is required here, not just omitting `behavior` —
    // the track has `scroll-smooth` CSS (so goTo()'s manual prev/next
    // scrolls animate nicely), and scrollIntoView's default "auto"
    // behavior inherits that CSS, which made opening any card past the
    // first visibly animate through every card above it first.
    el?.scrollIntoView({ block: "start", behavior: "instant" });
    // Only run on mount: this seeks to the opened card, subsequent index
    // changes come from the user's own scroll and shouldn't re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const index = Array.from(track.children).indexOf(entry.target);
            // The browser can deliver multiple callbacks for the same
            // settled index (e.g. as images above/below finish loading and
            // shift layout) — only report real changes so onIndexChange
            // doesn't fire (and rewrite the URL) redundantly for the card
            // that's already active.
            if (index !== -1 && index !== lastReportedIndexRef.current) {
              lastReportedIndexRef.current = index;
              setActiveIndex(index);
              onIndexChange?.(index);
            }
          }
        }
      },
      { root: track, threshold: [0.6] }
    );

    for (const child of Array.from(track.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [cards, onIndexChange]);

  function goTo(index: number) {
    if (index < 0 || index >= cards.length) return;
    const el = trackRef.current?.children[index] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") goTo(activeIndex + 1);
      if (e.key === "ArrowUp") goTo(activeIndex - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, activeIndex]);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      style={{ top: "var(--header-h)" }}
    >
      <div className="relative flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-card border border-border bg-background shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close reader"
          className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <X className="size-5" />
        </button>

        <div
          ref={trackRef}
          className="no-scrollbar h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth"
        >
          {cards.map((card) => (
            <section
              key={card.id}
              className="relative flex h-full w-full snap-start flex-col [scroll-snap-stop:always]"
            >
              <div className="relative h-[45%] w-full shrink-0 sm:h-[55%]">
                <Image
                  src={card.image_url}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
                <div className="absolute left-4 top-4">
                  <CategoryBadge category={card.category} />
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
                <h1 className="text-xl font-bold leading-snug text-foreground">
                  {card.headline}
                </h1>

                <div className="flex flex-wrap items-center gap-3">
                  {card.game && card.game_label && (
                    <>
                      <GameBadge
                        slug={card.game}
                        label={card.game_label}
                        className="text-sm font-semibold text-accent hover:text-accent-hover"
                      />
                      <FollowButton gameSlug={card.game} />
                    </>
                  )}
                  <LikeButton cardId={card.id} initialCount={card.like_count} />
                  <Link
                    href={`/news/${card.slug}#comments`}
                    className="flex items-center gap-1.5 text-sm text-foreground-muted hover:text-foreground"
                  >
                    <MessageCircle className="size-4" />
                    {card.comment_count}
                  </Link>
                </div>

                <p className="text-sm leading-relaxed text-foreground-muted">
                  {card.summary}
                </p>

                <div className="flex flex-wrap gap-2">
                  {card.platform_tags.map((p) => (
                    <PlatformChip key={p} platform={p} />
                  ))}
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4 text-sm text-foreground-subtle">
                  <div className="flex items-center justify-between">
                    <span>
                      {card.source_name} · {formatRelativeTime(card.published_at)}
                    </span>
                    <a
                      href={card.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent hover:text-accent-hover"
                    >
                      Read full story →
                    </a>
                  </div>
                  <div className="flex justify-center">
                    <ShareButtons
                      url={`${getSiteUrl()}/news/${card.slug}`}
                      title={card.headline}
                    />
                  </div>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
