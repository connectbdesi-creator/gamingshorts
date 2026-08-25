"use client";

import Link from "next/link";

export function GameBadge({
  slug,
  label,
  className,
}: {
  slug: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={`/game/${slug}`}
      onClick={(e) => e.stopPropagation()}
      className={className ?? "text-xs font-medium text-accent hover:text-accent-hover"}
    >
      {label}
    </Link>
  );
}
