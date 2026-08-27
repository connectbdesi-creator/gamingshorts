import type { Metadata } from "next";
import Link from "next/link";
import { FallbackImage } from "@/components/media/fallback-image";
import { getAllCards } from "@/lib/cards";
import { getAllGames } from "@/lib/game-info";
import { getGameIndex } from "@/lib/games";
import { pageAlternates } from "@/lib/site";
import type { GameInfo } from "@/types/game-info";

export const revalidate = 7200;

export const metadata: Metadata = {
  title: "Release Calendar",
  description:
    "Upcoming video game releases across PC, PlayStation, Xbox, Switch, mobile, and VR — auto-derived from ingested game data, updated every 2 hours.",
  alternates: pageAlternates("/release-calendar"),
  openGraph: {
    type: "website",
    title: "Release Calendar",
    description: "Upcoming video game releases across every platform.",
  },
};

/**
 * A game can end up with more than one games.json entry for the same real
 * title (see scripts/ingest/game-info.ts's exact-match safety net — it
 * prevents wrong matches, not duplicate slugs referring to the same game,
 * e.g. "gta-6" vs "grand-theft-auto-6"). De-duped here by name+release
 * date rather than in the data itself, preferring whichever duplicate
 * slug actually has real news cards attached (so the link goes somewhere
 * useful) and falling back to the shorter slug.
 */
function dedupeUpcoming(games: GameInfo[], slugsWithNews: Set<string>): GameInfo[] {
  const bySignature = new Map<string, GameInfo>();

  for (const game of games) {
    const signature = `${game.name.trim().toLowerCase()}|${game.released}`;
    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, game);
      continue;
    }

    const existingHasNews = slugsWithNews.has(existing.slug);
    const candidateHasNews = slugsWithNews.has(game.slug);
    if (candidateHasNews && !existingHasNews) {
      bySignature.set(signature, game);
    } else if (candidateHasNews === existingHasNews && game.slug.length < existing.slug.length) {
      bySignature.set(signature, game);
    }
  }

  return Array.from(bySignature.values()).sort(
    (a, b) => new Date(a.released!).getTime() - new Date(b.released!).getTime()
  );
}

function formatMonthHeading(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function ReleaseCalendarPage() {
  const cards = getAllCards();
  const slugsWithNews = new Set(getGameIndex(cards).map((g) => g.slug));
  const allGames = getAllGames();

  const now = new Date();
  const upcoming = dedupeUpcoming(
    allGames.filter((g) => g.released && new Date(g.released) >= now),
    slugsWithNews
  );

  const byMonth = new Map<string, GameInfo[]>();
  for (const game of upcoming) {
    const key = formatMonthHeading(new Date(game.released!));
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(game);
    else byMonth.set(key, [game]);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold text-foreground">Release Calendar</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Upcoming video game releases, derived from the same game data that powers every{" "}
        <span className="font-medium text-foreground">/game</span> page — updated automatically as new
        release dates are confirmed.
      </p>

      {upcoming.length === 0 ? (
        <p className="mt-8 rounded-card border border-dashed border-border p-6 text-center text-sm text-foreground-subtle">
          No confirmed upcoming release dates yet — check back after the next ingestion run.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {Array.from(byMonth.entries()).map(([month, games]) => (
            <section key={month}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground-subtle">
                {month}
              </h2>
              <div className="flex flex-col gap-2">
                {games.map((game) => (
                  <Link
                    key={game.slug}
                    href={`/game/${game.slug}`}
                    className="flex items-center gap-4 rounded-card border border-border bg-surface p-3 transition-colors hover:border-accent/50"
                  >
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-chip bg-background-elevated">
                      {game.background_image && (
                        <FallbackImage
                          src={game.background_image}
                          alt={`${game.name} artwork`}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-foreground">{game.name}</div>
                      {game.platforms.length > 0 && (
                        <div className="truncate text-xs text-foreground-subtle">
                          {game.platforms.join(", ")}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-sm font-medium text-accent">
                      {formatDay(new Date(game.released!))}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
