"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getExistingPushSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push";
import { useHasMounted } from "@/lib/use-has-mounted";
import { cn } from "@/lib/utils";

/**
 * Global "enable notifications" toggle — decoupled from following any
 * specific game, since a visitor subscribes to push once and then any
 * game they follow can notify them (scripts/ingest/push.ts looks up
 * followers-with-a-subscription per new card, not the other way around).
 */
export function NotificationToggle({ className }: { className?: string }) {
  const mounted = useHasMounted();
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    getExistingPushSubscription()
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
  }, [mounted]);

  async function toggle() {
    if (pending) return;
    setPending(true);
    setError(null);

    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        await subscribeToPush();
        setSubscribed(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  // isPushSupported() touches navigator/window, so it can only run safely
  // once mounted — same reasoning as ThemeToggle's hydration guard.
  if (!mounted || !isPushSupported()) return null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={subscribed}
        aria-label={subscribed ? "Disable push notifications" : "Enable push notifications"}
        title={subscribed ? "Notifications on" : "Enable notifications"}
        className={cn(
          "flex size-9 items-center justify-center rounded-full border transition-colors",
          subscribed
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-surface text-foreground-muted hover:bg-surface-hover hover:text-foreground"
        )}
      >
        {subscribed ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      </button>
      {error && (
        <span className="absolute right-0 top-full mt-1 w-48 rounded-card border border-border bg-surface p-2 text-xs text-foreground-subtle shadow-lg">
          {error}
        </span>
      )}
    </div>
  );
}
