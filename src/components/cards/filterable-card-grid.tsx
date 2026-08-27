"use client";

import { useEffect, useMemo, useState } from "react";
import { CardGrid } from "@/components/cards/card-grid";
import {
  CategoryDropdown,
  type CategoryFilterValue,
} from "@/components/filters/category-dropdown";
import { GameDropdown, type GameFilterValue } from "@/components/filters/game-dropdown";
import { PlatformDropdown } from "@/components/filters/platform-dropdown";
import { SearchInput } from "@/components/filters/search-input";
import { SwipeReader } from "@/components/reader/swipe-reader";
import { formatSourceNames } from "@/lib/format";
import { getTrendingGames } from "@/lib/games";
import type { PlatformSlug } from "@/lib/platforms";
import type { Card } from "@/types/card";

/**
 * Client-side grid + filter + reader orchestrator used by the homepage,
 * category pages, and the deals page. Category/platform/game filtering and
 * search all happen in-memory (no navigation) so they stay instant; opening
 * a card pushes a real history entry for its permanent /news/[slug] URL so
 * the browser back button and shared links both behave correctly, without a
 * full page navigation or data refetch.
 */
export function FilterableCardGrid({
  cards,
  extendedCards,
  showCategoryTabs = false,
  showPlatformFilter = true,
  showGameFilter = showPlatformFilter,
}: {
  cards: Card[];
  /**
   * Wider pool used only once a specific game is selected. Exists for the
   * homepage: its `cards` prop is already restricted to the last 24h (the
   * "front page" editorial window), which meant picking a specific game
   * from the filter showed only whatever happened to publish in that
   * window — often just a handful of cards, or none, even for a game
   * with plenty of recent coverage days 2-30 ago. Pages that already pass
   * their full, unrestricted card set (category/platform/trending/
   * hot-topics/deals) don't need this — `cards` already covers everything.
   */
  extendedCards?: Card[];
  showCategoryTabs?: boolean;
  showPlatformFilter?: boolean;
  showGameFilter?: boolean;
}) {
  const [category, setCategory] = useState<CategoryFilterValue>("all");
  const [platforms, setPlatforms] = useState<Set<PlatformSlug>>(new Set());
  const [game, setGame] = useState<GameFilterValue>("all");
  const [search, setSearch] = useState("");
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // The game dropdown itself still lists what's trending within the
  // default (e.g. last-24h) pool, not diluted by the wider one — "trending
  // games" should mean trending right now, same as everywhere else it's
  // shown (header, footer).
  const trendingGames = useMemo(() => getTrendingGames(cards, 10), [cards]);
  const baseCards = game !== "all" && extendedCards ? extendedCards : cards;

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return baseCards.filter((card) => {
      if (category !== "all" && card.category !== category) return false;
      if (platforms.size > 0 && !card.platform_tags.some((p) => platforms.has(p))) return false;
      if (game !== "all" && card.game !== game) return false;
      if (query) {
        const haystack = `${card.headline} ${card.summary} ${card.game_label ?? ""} ${formatSourceNames(card.sources)}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [baseCards, category, platforms, game, search]);

  function togglePlatform(platform: PlatformSlug) {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }

  function clearPlatforms() {
    setPlatforms(new Set());
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
      {(showCategoryTabs || showPlatformFilter || showGameFilter) && (
        <div className="flex flex-wrap items-center gap-2">
          {showCategoryTabs && <CategoryDropdown value={category} onChange={setCategory} />}
          {showPlatformFilter && (
            <PlatformDropdown
              selected={platforms}
              onToggle={togglePlatform}
              onClear={clearPlatforms}
            />
          )}
          {showGameFilter && trendingGames.length > 0 && (
            <GameDropdown games={trendingGames} value={game} onChange={setGame} />
          )}
          {showGameFilter && <SearchInput value={search} onChange={setSearch} />}
        </div>
      )}
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
