"use client";

import { PLATFORMS, type PlatformSlug } from "@/lib/platforms";
import { cn } from "@/lib/utils";

export function PlatformFilterBar({
  selected,
  onToggle,
}: {
  selected: Set<PlatformSlug>;
  onToggle: (platform: PlatformSlug) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {PLATFORMS.map((p) => {
        const active = selected.has(p.slug);
        return (
          <button
            key={p.slug}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(p.slug)}
            className={cn(
              "shrink-0 rounded-chip border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface text-foreground-muted hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}
