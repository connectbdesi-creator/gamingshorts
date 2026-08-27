import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/format/relative-time";
import { HeaderHeightObserver } from "@/components/layout/header-height-observer";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { getLastRefreshedAt } from "@/lib/meta";

export function SiteHeader() {
  const lastRefreshedAt = getLastRefreshedAt();

  return (
    <HeaderHeightObserver>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          Game<span className="text-accent">Shorts</span>
        </Link>

        <PrimaryNav />

        <div className="flex items-center gap-3">
          {lastRefreshedAt && (
            <span
              title={`Last refreshed ${new Date(lastRefreshedAt).toLocaleString()}`}
              className="hidden items-center gap-1.5 text-xs text-foreground-subtle sm:flex"
            >
              <RefreshCw className="size-3.5" />
              Updated <RelativeTime dateStr={lastRefreshedAt} />
            </span>
          )}
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </HeaderHeightObserver>
  );
}
