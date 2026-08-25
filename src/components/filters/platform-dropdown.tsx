"use client";

import { Check, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { PLATFORMS, type PlatformSlug } from "@/lib/platforms";
import { useClickOutside } from "@/lib/use-click-outside";
import { cn } from "@/lib/utils";

export function PlatformDropdown({
  selected,
  onToggle,
  onClear,
}: {
  selected: Set<PlatformSlug>;
  onToggle: (platform: PlatformSlug) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const label =
    selected.size === 0
      ? "All Platforms"
      : selected.size === 1
        ? (PLATFORMS.find((p) => selected.has(p.slug))?.label ?? "1 Platform")
        : `${selected.size} Platforms`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-chip border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent/50"
      >
        {label}
        <ChevronDown
          className={cn(
            "size-4 text-foreground-subtle transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+6px)] z-20 w-56 rounded-card border border-border bg-surface p-1 shadow-lg"
        >
          {PLATFORMS.map((p) => {
            const active = selected.has(p.slug);
            return (
              <button
                key={p.slug}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onToggle(p.slug)}
                className={cn(
                  "flex w-full items-center justify-between rounded-chip px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
                )}
              >
                {p.label}
                {active && <Check className="size-4" />}
              </button>
            );
          })}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="mt-1 block w-full rounded-chip border-t border-border px-3 py-2 text-left text-xs text-foreground-subtle hover:text-foreground"
            >
              Clear platforms
            </button>
          )}
        </div>
      )}
    </div>
  );
}
