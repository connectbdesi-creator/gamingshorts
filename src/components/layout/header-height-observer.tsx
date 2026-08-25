"use client";

import { useEffect, useRef } from "react";

/**
 * Renders the actual sticky <header> element and keeps the --header-h CSS
 * variable in sync with its real rendered height (it changes based on
 * viewport width and whether the trending-games row has content) — the
 * swipe reader reads this variable to sit below the header instead of
 * covering it.
 */
export function HeaderHeightObserver({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const setHeight = () =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);

    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      ref={ref}
      className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur"
    >
      {children}
    </header>
  );
}
