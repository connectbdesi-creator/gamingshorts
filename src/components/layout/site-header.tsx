import Link from "next/link";
import { HeaderHeightObserver } from "@/components/layout/header-height-observer";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function SiteHeader() {
  return (
    <HeaderHeightObserver>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          Game<span className="text-accent">Shorts</span>
        </Link>

        <PrimaryNav />

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </HeaderHeightObserver>
  );
}
