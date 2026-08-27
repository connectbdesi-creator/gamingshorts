"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

const DISMISSED_KEY = "gameshorts-install-dismissed-until";
const DISMISS_DAYS = 14;

// Not part of the DOM lib's type set yet (still a Chromium-only draft
// API) — beforeinstallprompt fires on Chrome/Edge/Android, never on
// Safari/iOS or Firefox, which have no programmatic install hook at all.
// This component simply never shows on those browsers, same as the
// browser's own native install affordance.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function readDismissedUntil(): number {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function writeDismissedUntil(days: number) {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  } catch {
    // Private browsing / storage disabled — the banner just re-shows next
    // visit, which is a fine fallback rather than something worth erroring.
  }
}

/**
 * Custom "Install GameShorts" banner on top of the browser's own install
 * affordance (CLAUDE.md's "Direct" traffic strategy) — visible once the
 * browser judges the site installable (manifest.ts + HTTPS + service
 * worker requirements met) and not already installed or recently
 * dismissed.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      if (Date.now() < readDismissedUntil()) return;
      setDeferredEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    function onAppInstalled() {
      setVisible(false);
      setDeferredEvent(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (!visible || !deferredEvent) return null;

  async function handleInstall() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;
    // Accepted or dismissed, the prompt is spent either way (a captured
    // beforeinstallprompt event can only be used once) — hide it and
    // don't nag again for a while even if the browser somehow re-fires.
    writeDismissedUntil(DISMISS_DAYS);
    setVisible(false);
    setDeferredEvent(null);
  }

  function handleDismiss() {
    writeDismissedUntil(DISMISS_DAYS);
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="flex w-full max-w-md items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-2xl">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-chip bg-accent/15 text-accent">
          <Download className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Install GameShorts</p>
          <p className="truncate text-xs text-foreground-subtle">Get news faster, right from your home screen.</p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="shrink-0 rounded-chip bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="shrink-0 text-foreground-subtle transition-colors hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
