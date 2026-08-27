"use client";

import { Code2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Copies an <iframe> snippet pointing at /embed/[slug] (the chrome-free
 * card view — see src/app/embed/[slug]/page.tsx) — CLAUDE.md's
 * "embeddable card widget for other sites to embed," which drives
 * backlinks since every embed carries a "Powered by GameShorts" link back.
 */
export function EmbedButton({ slug, siteUrl }: { slug: string; siteUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const snippet = `<iframe src="${siteUrl}/embed/${slug}" width="400" height="300" style="border:0;border-radius:12px;max-width:100%;" loading="lazy" title="GameShorts card"></iframe>`;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — the textarea
      // below still lets someone select-and-copy manually.
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Get embed code"
        aria-expanded={open}
        className="flex size-8 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:border-accent/50 hover:text-foreground"
      >
        <Code2 className="size-4" />
      </button>

      {open && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 w-72 -translate-x-1/2 rounded-card border border-border bg-surface p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-foreground">Embed this card</p>
          <textarea
            readOnly
            value={snippet}
            rows={3}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-chip border border-border bg-background-elevated p-2 text-[11px] text-foreground-muted"
          />
          <button
            type="button"
            onClick={copySnippet}
            className="mt-2 w-full rounded-chip bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>
      )}
    </div>
  );
}
