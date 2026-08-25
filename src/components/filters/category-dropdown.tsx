"use client";

import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { useClickOutside } from "@/lib/use-click-outside";
import { cn } from "@/lib/utils";

export type CategoryFilterValue = CategorySlug | "all";

const OPTIONS: { value: CategoryFilterValue; label: string }[] = [
  { value: "all", label: "All Categories" },
  ...CATEGORIES.map((c) => ({ value: c.slug as CategoryFilterValue, label: c.shortLabel })),
];

export function CategoryDropdown({
  value,
  onChange,
}: {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const selected = OPTIONS.find((o) => o.value === value) ?? OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-chip border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-accent/50"
      >
        {selected.label}
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
          className="absolute left-0 top-[calc(100%+6px)] z-20 w-48 rounded-card border border-border bg-surface p-1 shadow-lg"
        >
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={value === o.value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded-chip px-3 py-2 text-left text-sm transition-colors",
                value === o.value
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground-muted hover:bg-surface-hover hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
