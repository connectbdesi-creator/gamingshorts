"use client";

import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import type { GameEntry } from "@/lib/games";
import { useClickOutside } from "@/lib/use-click-outside";
import { cn } from "@/lib/utils";

export type GameFilterValue = string | "all";

export function GameDropdown({
  games,
  value,
  onChange,
}: {
  games: GameEntry[];
  value: GameFilterValue;
  onChange: (value: GameFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const selectedLabel =
    value === "all"
      ? "Trending Games"
      : (games.find((g) => g.slug === value)?.label ?? "Trending Games");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-chip border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent/50"
      >
        {selectedLabel}
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
          <button
            type="button"
            role="option"
            aria-selected={value === "all"}
            onClick={() => {
              onChange("all");
              setOpen(false);
            }}
            className={cn(
              "block w-full rounded-chip px-3 py-2 text-left text-sm transition-colors",
              value === "all"
                ? "bg-accent text-accent-foreground"
                : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
            )}
          >
            All Games
          </button>
          {games.map((g) => (
            <button
              key={g.slug}
              type="button"
              role="option"
              aria-selected={value === g.slug}
              onClick={() => {
                onChange(g.slug);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-chip px-3 py-2 text-left text-sm transition-colors",
                value === g.slug
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
