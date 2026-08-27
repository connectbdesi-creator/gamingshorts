"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { getVisitorId } from "@/lib/visitor";

/**
 * Toggleable follow button backed by the `game_follows` table (see
 * supabase/migrations/0002_create_games_and_push.sql). Same
 * graceful-degradation contract as LikeButton: if Supabase isn't
 * configured, this stays a disabled, non-interactive button rather than
 * breaking the page.
 */
export function FollowButton({ gameSlug }: { gameSlug: string }) {
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let supabase;
      try {
        supabase = await getSupabaseBrowserClient();
      } catch {
        return;
      }

      const visitorId = getVisitorId();
      const { data } = await supabase
        .from("game_follows")
        .select("id")
        .eq("game_slug", gameSlug)
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (cancelled) return;
      setFollowing(Boolean(data));
      setReady(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [gameSlug]);

  async function toggleFollow() {
    if (!ready || pending) return;

    let supabase;
    try {
      supabase = await getSupabaseBrowserClient();
    } catch {
      return;
    }

    const visitorId = getVisitorId();
    const nextFollowing = !following;

    setPending(true);
    setFollowing(nextFollowing);

    try {
      const { error } = nextFollowing
        ? await supabase.from("game_follows").insert({ game_slug: gameSlug, visitor_id: visitorId })
        : await supabase
            .from("game_follows")
            .delete()
            .eq("game_slug", gameSlug)
            .eq("visitor_id", visitorId);
      if (error) throw error;
    } catch {
      setFollowing(!nextFollowing);
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
        toggleFollow();
      }}
      disabled={!ready}
      aria-pressed={following}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-chip border px-3 py-1.5 text-sm font-medium transition-colors",
        following
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-surface text-foreground-muted hover:border-accent/50 hover:text-foreground",
        !ready && "cursor-default opacity-70"
      )}
    >
      {following ? <Check className="size-4" /> : <Plus className="size-4" />}
      {following ? "Following" : "Follow"}
    </button>
  );
}
