export const CATEGORIES = [
  {
    slug: "releases",
    label: "Releases & Launches",
    shortLabel: "Releases",
    colorVar: "var(--color-cat-releases)",
  },
  {
    slug: "reviews",
    label: "Reviews",
    shortLabel: "Reviews",
    colorVar: "var(--color-cat-reviews)",
  },
  {
    slug: "patches",
    label: "Patches & Updates",
    shortLabel: "Patches",
    colorVar: "var(--color-cat-patches)",
  },
  {
    slug: "industry",
    label: "Industry & Business",
    shortLabel: "Industry",
    colorVar: "var(--color-cat-industry)",
  },
  {
    slug: "esports",
    label: "Esports",
    shortLabel: "Esports",
    colorVar: "var(--color-cat-esports)",
  },
  {
    slug: "deals",
    label: "Deals & Sales",
    shortLabel: "Deals",
    colorVar: "var(--color-cat-deals)",
  },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function getCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}
