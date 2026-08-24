"use client";

import { Rows3 } from "lucide-react";
import { useState } from "react";
import { SwipeReader } from "@/components/reader/swipe-reader";
import type { Card } from "@/types/card";

/**
 * Lets a visitor who landed directly on a card's permanent URL (search,
 * shared link) drop into the same full-screen swipe reader the grid uses,
 * continuing through the rest of the catalog from this card onward.
 */
export function ArticleReaderLauncher({
  cards,
  startIndex,
}: {
  cards: Card[];
  startIndex: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 self-start rounded-chip border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground-muted transition-colors hover:border-accent/50 hover:text-foreground"
      >
        <Rows3 className="size-4" />
        Read in swipe view
      </button>

      {open && (
        <SwipeReader
          cards={cards}
          initialIndex={startIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
