"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function PrimaryNav() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar hidden items-center gap-1 overflow-x-auto text-sm text-foreground-muted sm:flex">
      {PRIMARY_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-chip px-3 py-1.5 transition-colors",
              item.href === "/hot-topics" && "hot-topics-glow",
              active
                ? "bg-accent text-accent-foreground"
                : "hover:bg-surface-hover hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
