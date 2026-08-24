import { getCategory } from "@/lib/categories";

export function CategoryBadge({ category }: { category: string }) {
  const info = getCategory(category);

  return (
    <span
      className="inline-flex items-center rounded-chip px-2.5 py-1 text-xs font-medium text-background-elevated"
      style={{ backgroundColor: info?.colorVar ?? "var(--color-foreground-subtle)" }}
    >
      {info?.shortLabel ?? category}
    </span>
  );
}
