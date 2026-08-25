import type { Metadata } from "next";

const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): string {
  // `??` only catches null/undefined — Vercel can hand this an empty
  // string (e.g. the env var exists but has no value set yet), which
  // `new URL("")` in the root layout's metadataBase then throws on.
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return value ? value : DEFAULT_SITE_URL;
}

/**
 * A page's own `alternates` metadata entirely replaces the root layout's
 * (Next.js doesn't deep-merge it), so any page that needs a canonical URL
 * has to also repeat the RSS feed link here or it silently disappears from
 * that page's <head> — this keeps both together in one place instead of
 * every page needing to remember that.
 */
export function pageAlternates(pathname: string): Metadata["alternates"] {
  return {
    canonical: `${getSiteUrl()}${pathname}`,
    types: { "application/rss+xml": [{ url: "/feed.xml", title: "GameShorts RSS Feed" }] },
  };
}
