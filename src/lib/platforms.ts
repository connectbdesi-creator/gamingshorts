export const PLATFORMS = [
  { slug: "pc", label: "PC" },
  { slug: "playstation", label: "PlayStation" },
  { slug: "xbox", label: "Xbox" },
  { slug: "switch", label: "Switch / Switch 2" },
  { slug: "mobile", label: "Mobile" },
  { slug: "vr", label: "VR" },
] as const;

export type PlatformSlug = (typeof PLATFORMS)[number]["slug"];

export function getPlatform(slug: string) {
  return PLATFORMS.find((p) => p.slug === slug);
}
