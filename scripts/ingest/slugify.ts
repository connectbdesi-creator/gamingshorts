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

/**
 * Kebab-cases a headline into a clean, SEO-friendly URL slug — no random
 * hash suffix. Collisions (two articles that kebab-case to the same text)
 * are rare but possible, so a short numeric suffix is appended only when
 * the plain slug is already taken, checked against `existingSlugs` (every
 * slug already in use, updated by the caller as each new one is minted so
 * within-run collisions are caught too, not just against past runs).
 */
export function slugify(headline: string, existingSlugs: Set<string>): string {
  const base = kebabCase(headline) || "story";
  if (!existingSlugs.has(base)) return base;

  let n = 2;
  while (existingSlugs.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
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
