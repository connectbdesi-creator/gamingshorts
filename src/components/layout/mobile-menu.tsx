"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * The primary nav (Trending/Releases/Reviews/Deals/Release Calendar) is
 * hidden below the sm breakpoint in PrimaryNav — this is the only way to
 * reach those pages on mobile.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation. Adjusted during render (React's documented
  // pattern for "reset state when a value changes") rather than in an
  // effect, since setState-in-effect triggers an extra render pass.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-64 rounded-card border border-border bg-surface p-2 shadow-lg">
          <nav className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-chip px-3 py-2.5 text-sm font-medium transition-colors",
                    item.href === "/hot-topics" && "hot-topics-glow",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}
