import { createHash } from "node:crypto";

export function hashId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

/** Kebab-cases a headline and appends a short stable hash to guarantee uniqueness. */
export function slugify(headline: string, uniqueSeed: string): string {
  const base = headline
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70)
    .replace(/-+$/, "");

  return `${base}-${hashId(uniqueSeed)}`;
}
