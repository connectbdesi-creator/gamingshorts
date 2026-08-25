"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { GameEntry } from "@/lib/games";
import { cn } from "@/lib/utils";

export function TrendingGamesRow({ games }: { games: GameEntry[] }) {
  const pathname = usePathname();

  if (games.length === 0) return null;

  return (
    <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 pb-3 text-sm">
      <span className="shrink-0 text-xs uppercase tracking-wide text-foreground-subtle">
        Trending games
      </span>
      {games.map((game) => {
        const active = pathname === `/game/${game.slug}`;
        return (
          <Link
            key={game.slug}
            href={`/game/${game.slug}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-chip border px-3 py-1.5 transition-colors",
              active
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border text-foreground-muted hover:border-accent/50 hover:text-foreground"
            )}
          >
            {game.label}
          </Link>
        );
      })}
    </div>
  );
}
