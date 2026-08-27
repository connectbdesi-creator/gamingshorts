"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * card.comment_count is a static field from ingestion time (always 0 — the
 * pipeline has no way to know a discussion's comment count) — this listens
 * for Giscus's discussion-metadata postMessage (see comments.tsx's
 * emitMetadata="1") and swaps in the real, live count once the widget
 * below on the same page loads. Silently keeps showing the static initial
 * count if that message never arrives (comments not configured, ad
 * blocker, etc.) rather than erroring.
 */
export function CommentCountBadge({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== "https://giscus.app") return;
      const discussion = (event.data as { giscus?: { discussion?: Record<string, unknown> } })?.giscus?.discussion;
      if (!discussion) return;

      const { totalCommentCount, totalReplyCount } = discussion;
      if (typeof totalCommentCount === "number" && typeof totalReplyCount === "number") {
        setCount(totalCommentCount + totalReplyCount);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <>
      <MessageCircle className="size-5" />
      {count}
    </>
  );
}
