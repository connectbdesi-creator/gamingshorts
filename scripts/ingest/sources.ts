import type { CategorySlug } from "@/lib/categories";

export interface RssSource {
  name: string;
  url: string;
  /**
   * Nudges the model toward a default category for this outlet (e.g. an
   * industry trade pub almost always publishes "industry" news). The model
   * still reads the actual article and can override it — this just breaks
   * ties and steers ambiguous cases.
   */
  defaultCategory?: CategorySlug;
}

/**
 * RSS sources from CLAUDE.md's ingestion list. Every URL below was checked
 * live (curl, 200 after following redirects) on 2026-08-24 — feed URLs do
 * drift over time, so if a fetch starts failing consistently in Actions,
 * that source's URL is the first thing to re-check.
 *
 * Nintendo's official newsroom has no discoverable public RSS feed (only
 * a JS-rendered page), so it's omitted here; Nintendo Life covers the same
 * platform at press/fan-outlet quality, and PlayStation Blog / Xbox Wire
 * below cover the other two platform holders' official channels.
 */
export const RSS_SOURCES: RssSource[] = [
  // Consumer press
  { name: "IGN", url: "https://www.ign.com/rss/articles/feed?tags=games" },
  { name: "Kotaku", url: "https://kotaku.com/feed" },
  { name: "Polygon", url: "https://www.polygon.com/rss/index.xml" },
  { name: "GameSpot", url: "https://www.gamespot.com/feeds/game-news/" },
  { name: "Eurogamer", url: "https://www.eurogamer.net/feed" },
  { name: "PC Gamer", url: "https://www.pcgamer.com/rss/" },
  { name: "Rock Paper Shotgun", url: "https://www.rockpapershotgun.com/feed" },
  { name: "VG247", url: "https://www.vg247.com/feed" },
  { name: "GamesRadar+", url: "https://www.gamesradar.com/feeds.xml" },
  { name: "VGC", url: "https://www.videogameschronicle.com/feed/" },
  { name: "Game Rant", url: "https://gamerant.com/feed/" },
  { name: "TheGamer", url: "https://www.thegamer.com/feed/" },

  // Platform-specific
  { name: "Nintendo Life", url: "https://www.nintendolife.com/feeds/latest" },
  { name: "Push Square", url: "https://www.pushsquare.com/feeds/latest", defaultCategory: "reviews" },
  { name: "Pure Xbox", url: "https://www.purexbox.com/feeds/latest" },

  // Official sources
  { name: "PlayStation Blog", url: "https://blog.playstation.com/feed/" },
  { name: "Xbox Wire", url: "https://news.xbox.com/en-us/feed/" },
  { name: "Steam", url: "https://store.steampowered.com/feeds/news.xml", defaultCategory: "deals" },

  // Trade / industry
  { name: "GamesIndustry.biz", url: "https://www.gamesindustry.biz/feed", defaultCategory: "industry" },
  { name: "VentureBeat", url: "https://gamesbeat.com/feed/", defaultCategory: "industry" },

  // Regional
  { name: "Automaton", url: "https://automaton-media.com/en/feed/" },
  { name: "Gematsu", url: "https://www.gematsu.com/feed" },
];
