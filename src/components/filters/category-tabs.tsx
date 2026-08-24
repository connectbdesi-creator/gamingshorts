"use client";

import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type CategoryFilterValue = CategorySlug | "all";

export function CategoryTabs({
  value,
  onChange,
}: {
  value: CategoryFilterValue;
  onChange: (value: CategoryFilterValue) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      <button
        type="button"
        onClick={() => onChange("all")}
        className={cn(
          "shrink-0 rounded-chip border px-3 py-1.5 text-sm font-medium transition-colors",
          value === "all"
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface text-foreground-muted hover:text-foreground"
        )}
      >
        All
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c.slug}
          type="button"
          onClick={() => onChange(c.slug)}
          className={cn(
            "shrink-0 rounded-chip border px-3 py-1.5 text-sm font-medium transition-colors",
            value === c.slug
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface text-foreground-muted hover:text-foreground"
          )}
        >
          {c.shortLabel}
        </button>
      ))}
    </div>
  );
}
