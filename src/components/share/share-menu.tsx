"use client";

import { Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ShareButtons } from "@/components/share/share-buttons";

/**
 * Compact share affordance for grid cards: a single icon that reveals the
 * full ShareButtons row in a small popover, so 20+ cards don't each carry
 * four always-visible icons.
 */
export function ShareMenu({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Share this card"
        aria-expanded={open}
        className="flex items-center gap-1 text-xs font-medium text-foreground-muted transition-colors hover:text-foreground"
      >
        <Share2 className="size-3.5" />
      </button>

      {open && (
        <div
          className="absolute bottom-full right-0 z-10 mb-2 rounded-card border border-border bg-surface p-2 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <ShareButtons url={url} title={title} />
        </div>
      )}
    </div>
  );
}
