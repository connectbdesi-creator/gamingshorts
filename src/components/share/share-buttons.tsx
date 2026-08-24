"use client";

import { useState } from "react";
import { FaDiscord, FaRedditAlien, FaWhatsapp, FaXTwitter } from "react-icons/fa6";
import { buildShareLinks } from "@/components/share/share-links";
import { cn } from "@/lib/utils";

const iconButtonClass =
  "flex size-8 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:border-accent/50 hover:text-foreground";

/**
 * Inline row of the four share channels CLAUDE.md's traffic strategy
 * calls for. Discord has no web share-intent URL, so that button copies
 * the link instead — pasting into a Discord channel is the actual share
 * action there.
 */
export function ShareButtons({
  url,
  title,
  className,
}: {
  url: string;
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const links = buildShareLinks(url, title);

  async function copyForDiscord() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — silently no-op.
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <a
        href={links.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on WhatsApp"
        onClick={(e) => e.stopPropagation()}
        className={iconButtonClass}
      >
        <FaWhatsapp className="size-4" />
      </a>
      <a
        href={links.x}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        onClick={(e) => e.stopPropagation()}
        className={iconButtonClass}
      >
        <FaXTwitter className="size-4" />
      </a>
      <a
        href={links.reddit}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Reddit"
        onClick={(e) => e.stopPropagation()}
        className={iconButtonClass}
      >
        <FaRedditAlien className="size-4" />
      </a>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copyForDiscord();
        }}
        aria-label="Copy link to share on Discord"
        className={iconButtonClass}
      >
        <FaDiscord className="size-4" />
      </button>
      {copied && <span className="text-xs text-foreground-subtle">Link copied</span>}
    </div>
  );
}
