const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): string {
  // `??` only catches null/undefined — Vercel can hand this an empty
  // string (e.g. the env var exists but has no value set yet), which
  // `new URL("")` in the root layout's metadataBase then throws on.
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return value ? value : DEFAULT_SITE_URL;
}
