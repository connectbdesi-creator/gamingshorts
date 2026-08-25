import { createHash } from "node:crypto";

export function hashId(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function kebabCase(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70)
    .replace(/-+$/, "");
}

/** Kebab-cases a headline and appends a short stable hash to guarantee uniqueness. */
export function slugify(headline: string, uniqueSeed: string): string {
  return `${kebabCase(headline)}-${hashId(uniqueSeed)}`;
}

/**
 * Kebab-cases a game display name into its canonical slug, deliberately
 * WITHOUT a uniqueness hash — every article about the same game must
 * resolve to the same slug so they group together (follows, /game/[slug],
 * the trending-games row). Different articles calling the same game
 * slightly different things (e.g. "VALORANT" vs "Valorant") still collide
 * onto one slug since casing is stripped.
 */
export function slugifyGameName(gameLabel: string): string {
  return kebabCase(gameLabel);
}
