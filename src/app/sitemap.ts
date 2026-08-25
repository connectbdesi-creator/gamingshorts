import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/categories";
import { getAllCards } from "@/lib/cards";
import { getGameIndex } from "@/lib/games";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const cards = getAllCards();
  const games = getGameIndex(cards);

  const staticPages: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/trending`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/deals`, changeFrequency: "hourly", priority: 0.8 },
    { url: `${base}/release-calendar`, changeFrequency: "daily", priority: 0.7 },
  ];

  const categoryPages: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${base}/category/${c.slug}`,
    changeFrequency: "hourly",
    priority: 0.7,
  }));

  const gamePages: MetadataRoute.Sitemap = games.map((g) => ({
    url: `${base}/game/${g.slug}`,
    lastModified: g.latestPublishedAt,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const articlePages: MetadataRoute.Sitemap = cards.map((c) => ({
    url: `${base}/news/${c.slug}`,
    lastModified: c.published_at,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...staticPages, ...categoryPages, ...gamePages, ...articlePages];
}
