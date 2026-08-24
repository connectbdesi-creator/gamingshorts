import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CATEGORIES } from "@/lib/categories";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          Game<span className="text-accent">Shorts</span>
        </Link>

        <nav className="flex items-center gap-2 text-sm text-foreground-muted">
          <Link
            href="/release-calendar"
            className="hidden rounded-chip px-3 py-1.5 transition-colors hover:bg-surface-hover hover:text-foreground sm:block"
          >
            Release Calendar
          </Link>
          <Link
            href="/deals"
            className="hidden rounded-chip px-3 py-1.5 transition-colors hover:bg-surface-hover hover:text-foreground sm:block"
          >
            Deals
          </Link>
        </nav>

        <ThemeToggle />
      </div>

      <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-3 text-sm">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/category/${c.slug}`}
            className="shrink-0 rounded-chip border border-border px-3 py-1.5 text-foreground-muted transition-colors hover:border-accent/50 hover:text-foreground"
          >
            {c.shortLabel}
          </Link>
        ))}
      </div>
    </header>
  );
}
