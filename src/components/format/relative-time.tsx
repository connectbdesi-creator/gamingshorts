"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/format";

/**
 * Client-computed relative time ("5m ago"). formatRelativeTime's default
 * `now` parameter evaluates fresh on every call — on a statically/ISR
 * cached page (revalidate=7200, up to 2h stale, used across this project)
 * that meant the server baked in a value at BUILD time, then hydration
 * immediately recomputed a DIFFERENT one from the real current time. That
 * wasn't just a hydration-mismatch console warning: it meant a visitor
 * could see a stale/wrong "Xm ago" until some unrelated re-render fixed
 * it. Computing it client-side (after mount, refreshed every minute) keeps
 * it accurate against the visitor's actual clock regardless of how old the
 * cached HTML is. suppressHydrationWarning covers the expected one-tick
 * mismatch between the server's snapshot and this component's own first
 * client computation.
 */
export function RelativeTime({ dateStr }: { dateStr: string }) {
  // The lazy initializer already runs client-side (during hydration, using
  // the browser's actual clock) — no need to also set it again immediately
  // inside the effect below, only the recurring update needs one.
  const [text, setText] = useState(() => formatRelativeTime(dateStr));

  useEffect(() => {
    const id = setInterval(() => setText(formatRelativeTime(dateStr)), 60_000);
    return () => clearInterval(id);
  }, [dateStr]);

  return <span suppressHydrationWarning>{text}</span>;
}
