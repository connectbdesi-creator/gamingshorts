"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getVisitorId } from "@/lib/visitor";

/**
 * Toggleable like button backed by the `likes` table (see
 * supabase/migrations/0001_create_likes.sql). If Supabase env vars aren't
 * configured yet, this degrades to a static, non-interactive display of
 * `initialCount` instead of breaking the page.
 */
export function LikeButton({
  cardId,
  initialCount,
  size = "md",
}: {
  cardId: string;
  initialCount: number;
  size?: "sm" | "md";
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let supabase;
      try {
        supabase = getSupabaseBrowserClient();
      } catch {
        return;
      }

      const visitorId = getVisitorId();
      const [countResult, existingResult] = await Promise.all([
        supabase
          .from("likes")
          .select("id", { count: "exact", head: true })
          .eq("card_id", cardId),
        supabase
          .from("likes")
          .select("id")
          .eq("card_id", cardId)
          .eq("visitor_id", visitorId)
          .maybeSingle(),
      ]);

      if (cancelled) return;
      if (typeof countResult.count === "number") setCount(countResult.count);
      setLiked(Boolean(existingResult.data));
      setReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  async function toggleLike() {
    if (!ready || pending) return;

    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }

    const visitorId = getVisitorId();
    const nextLiked = !liked;

    setPending(true);
    setLiked(nextLiked);
    setCount((c) => c + (nextLiked ? 1 : -1));

    try {
      const { error } = nextLiked
        ? await supabase.from("likes").insert({ card_id: cardId, visitor_id: visitorId })
        : await supabase
            .from("likes")
            .delete()
            .eq("card_id", cardId)
            .eq("visitor_id", visitorId);
      if (error) throw error;
    } catch {
      setLiked(!nextLiked);
      setCount((c) => c + (nextLiked ? -1 : 1));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleLike();
      }}
      disabled={!ready}
      aria-pressed={liked}
      aria-label={liked ? "Unlike" : "Like"}
      className={cn(
        "flex items-center gap-1.5 transition-colors",
        liked ? "text-like" : "text-foreground-muted hover:text-like",
        !ready && "cursor-default",
        size === "sm" ? "text-xs" : "text-sm"
      )}
    >
      <Heart className={cn(size === "sm" ? "size-3.5" : "size-4", liked && "fill-current")} />
      {count}
    </button>
  );
}
