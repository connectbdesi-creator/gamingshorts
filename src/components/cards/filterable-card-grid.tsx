"use client";

import { useEffect, useMemo, useState } from "react";
import { CardGrid } from "@/components/cards/card-grid";
import {
  CategoryTabs,
  type CategoryFilterValue,
} from "@/components/filters/category-tabs";
import { PlatformFilterBar } from "@/components/filters/platform-filter-bar";
import { SwipeReader } from "@/components/reader/swipe-reader";
import type { PlatformSlug } from "@/lib/platforms";
import type { Card } from "@/types/card";

/**
 * Client-side grid + filter + reader orchestrator used by the homepage,
 * category pages, and the deals page. Category/platform filtering happens
 * in-memory (no navigation) so it stays instant; opening a card pushes a
 * real history entry for its permanent /news/[slug] URL so the browser
 * back button and shared links both behave correctly, without a full page
 * navigation or data refetch.
 */
export function FilterableCardGrid({
  cards,
  showCategoryTabs = false,
}: {
  cards: Card[];
  showCategoryTabs?: boolean;
}) {
  const [category, setCategory] = useState<CategoryFilterValue>("all");
  const [platforms, setPlatforms] = useState<Set<PlatformSlug>>(new Set());
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (category !== "all" && card.category !== category) return false;
      if (platforms.size === 0) return true;
      return card.platform_tags.some((p) => platforms.has(p));
    });
  }, [cards, category, platforms]);

  function togglePlatform(platform: PlatformSlug) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  function openCard(card: Card) {
    const index = filteredCards.findIndex((c) => c.id === card.id);
    if (index === -1) return;
    setOpenIndex(index);
    window.history.pushState({ reader: true }, "", `/news/${card.slug}`);
  }

  function closeReader() {
    window.history.back();
  }

  function syncUrlToIndex(index: number) {
    const card = filteredCards[index];
    if (card) window.history.replaceState({ reader: true }, "", `/news/${card.slug}`);
  }

  useEffect(() => {
    if (openIndex === null) return;
    function onPopState() {
      setOpenIndex(null);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openIndex]);

  return (
    <div className="flex flex-col gap-4">
      {showCategoryTabs && <CategoryTabs value={category} onChange={setCategory} />}
      <PlatformFilterBar selected={platforms} onToggle={togglePlatform} />
      <CardGrid cards={filteredCards} onOpen={openCard} />

      {openIndex !== null && (
        <SwipeReader
          cards={filteredCards}
          initialIndex={openIndex}
          onClose={closeReader}
          onIndexChange={syncUrlToIndex}
        />
      )}
    </div>
  );
}
