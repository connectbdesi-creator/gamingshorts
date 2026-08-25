import Link from "next/link";
import { getAllCards } from "@/lib/cards";
import { getTrendingGames } from "@/lib/games";
import { SITE_OPERATOR } from "@/lib/legal";
import { FOOTER_LEGAL_NAV, FOOTER_PLATFORM_NAV, PRIMARY_NAV } from "@/lib/nav";

export async function SiteFooter() {
  const trendingGames = getTrendingGames(getAllCards(), 5);

  return (
    <footer className="border-t border-border bg-background-elevated">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-8 px-4 py-10 sm:grid-cols-4">
        <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
          <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
            Game<span className="text-accent">Shorts</span>
          </Link>
          <p className="text-sm leading-relaxed text-foreground-muted">
            Video game industry news — releases, reviews, patches, and deals
            — summarized into 60-word cards, refreshed around the clock.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Platforms
          </h2>
          <nav className="flex flex-col gap-2 text-sm text-foreground-muted">
            {FOOTER_PLATFORM_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="w-fit hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Explore
          </h2>
          <nav className="flex flex-col gap-2 text-sm text-foreground-muted">
            <Link href="/" className="w-fit hover:text-foreground">
              Home
            </Link>
            {PRIMARY_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="w-fit hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
            Trending Games
          </h2>
          {trendingGames.length > 0 ? (
            <nav className="flex flex-col gap-2 text-sm text-foreground-muted">
              {trendingGames.map((game) => (
                <Link
                  key={game.slug}
                  href={`/game/${game.slug}`}
                  className="w-fit hover:text-foreground"
                >
                  {game.label}
                </Link>
              ))}
            </nav>
          ) : (
            <p className="text-sm text-foreground-subtle">Check back soon.</p>
          )}
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-foreground-subtle sm:flex-row">
          <p>
            © {new Date().getFullYear()} {SITE_OPERATOR}. All rights reserved.
          </p>
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {FOOTER_LEGAL_NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
