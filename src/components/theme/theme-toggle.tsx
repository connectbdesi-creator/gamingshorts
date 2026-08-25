"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHasMounted } from "@/lib/use-has-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return <div className="size-9" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex size-9 items-center justify-center rounded-full border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
