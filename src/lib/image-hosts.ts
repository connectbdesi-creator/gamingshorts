/**
 * Single source of truth for every image hostname this site is allowed to
 * render via next/image — next.config.ts builds its `remotePatterns` from
 * this list, and FallbackImage (src/components/media/fallback-image.tsx)
 * checks incoming URLs against it before ever handing them to next/image.
 *
 * That second check matters on its own: an unlisted hostname doesn't fail
 * soft (a 404/403, which FallbackImage's onError already handles) — it
 * makes next/image throw synchronously and crash the whole page with a
 * 500, since Next treats an unconfigured remote host as a misconfigured
 * security boundary, not a normal load failure. New RSS sources or a CDN
 * subdomain change (e.g. IGN serving from both assets-prd.ignimgs.com and
 * assets1.ignimgs.com) can introduce an unlisted host at any time — this
 * makes that degrade to the placeholder instead of taking the page down.
 */
export const ALLOWED_IMAGE_HOSTNAMES = [
  // Placeholder art — used for mock cards, as the fallback when a real
  // article has no usable enclosure/media:content image, and as
  // FallbackImage's own runtime fallback.
  "picsum.photos",

  // Real source-outlet image CDNs, confirmed live by fetching each
  // RSS_SOURCES feed (scripts/ingest/sources.ts) and inspecting the
  // hostname of its enclosure/media:content image on 2026-08-24. Several
  // outlets in that list didn't expose an image in their feed at check
  // time (PlayStation Blog, Xbox Wire, Steam, VentureBeat, Automaton,
  // Gematsu, VGC) — those fall back to the placeholder above rather than
  // needing an entry here. If a new source is added to RSS_SOURCES,
  // re-check its feed and add its image domain here.
  "assets-prd.ignimgs.com", // IGN
  "assets1.ignimgs.com", // IGN — some articles serve from this host instead
  "kotaku.com",
  "static0.polygonimages.com",
  "www.gamespot.com",
  "assetsio.gnwcdn.com", // Eurogamer, RPS, VG247, GamesIndustry.biz (shared Gamer Network CDN)
  "cdn.mos.cms.futurecdn.net", // PC Gamer, GamesRadar+ (shared Future plc CDN)
  "static0.gamerantimages.com",
  "static0.thegamerimages.com",
  "images.nintendolife.com",
  "images.pushsquare.com",
  "images.purexbox.com",

  // RAWG's media CDN (scripts/ingest/game-info.ts, background_image +
  // screenshots on /game/[slug]).
  "media.rawg.io",
];
