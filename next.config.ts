import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Placeholder art — used for mock cards and as the fallback when a
      // real article has no usable enclosure/media:content image.
      { protocol: "https", hostname: "picsum.photos" },

      // Real source-outlet image CDNs, confirmed live by fetching each
      // RSS_SOURCES feed (scripts/ingest/sources.ts) and inspecting the
      // hostname of its enclosure/media:content image on 2026-08-24.
      // Several outlets in that list didn't expose an image in their feed
      // at check time (PlayStation Blog, Xbox Wire, Steam, VentureBeat,
      // Automaton, Gematsu, VGC) — those fall back to the placeholder
      // above rather than needing an entry here. If a new source is added
      // to RSS_SOURCES, re-check its feed and add its image domain here,
      // or its images will silently fall back to the placeholder too.
      { protocol: "https", hostname: "assets-prd.ignimgs.com" }, // IGN
      { protocol: "https", hostname: "kotaku.com" },
      { protocol: "https", hostname: "static0.polygonimages.com" },
      { protocol: "https", hostname: "www.gamespot.com" },
      { protocol: "https", hostname: "assetsio.gnwcdn.com" }, // Eurogamer, RPS, VG247, GamesIndustry.biz (shared Gamer Network CDN)
      { protocol: "https", hostname: "cdn.mos.cms.futurecdn.net" }, // PC Gamer, GamesRadar+ (shared Future plc CDN)
      { protocol: "https", hostname: "static0.gamerantimages.com" },
      { protocol: "https", hostname: "static0.thegamerimages.com" },
      { protocol: "https", hostname: "images.nintendolife.com" },
      { protocol: "https", hostname: "images.pushsquare.com" },
      { protocol: "https", hostname: "images.purexbox.com" },
    ],
  },
};

export default nextConfig;
