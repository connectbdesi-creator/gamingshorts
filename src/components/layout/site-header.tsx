import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getAllCards } from "@/lib/cards";
import { getTrendingGames } from "@/lib/games";

const PRIMARY_NAV = [
  { href: "/trending", label: "Trending" },
  { href: "/category/releases", label: "Releases" },
  { href: "/category/reviews", label: "Reviews" },
  { href: "/deals", label: "Deals" },
  { href: "/release-calendar", label: "Release Calendar" },
];

export async function SiteHeader() {
  const trendingGames = getTrendingGames(getAllCards(), 5);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          Game<span className="text-accent">Shorts</span>
        </Link>

        <nav className="no-scrollbar hidden items-center gap-1 overflow-x-auto text-sm text-foreground-muted sm:flex">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-chip px-3 py-1.5 transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <ThemeToggle />
      </div>

      {trendingGames.length > 0 && (
        <div className="no-scrollbar mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 pb-3 text-sm">
          <span className="shrink-0 text-xs uppercase tracking-wide text-foreground-subtle">
            Trending games
          </span>
          {trendingGames.map((game) => (
            <Link
              key={game.slug}
              href={`/game/${game.slug}`}
              className="shrink-0 rounded-chip border border-border px-3 py-1.5 text-foreground-muted transition-colors hover:border-accent/50 hover:text-foreground"
            >
              {game.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
