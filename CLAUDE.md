# CLAUDE.md

This file provides project context for Claude (or any developer/agent) working on this codebase.

---

## Project Name
**(working title)** GameShorts / Gaming Signal Brief — an Inshorts-style, 60-word news site for the video game industry.

## One-line summary
A card-based news site that summarizes video game industry news, reviews, releases, patches, esports, and deals into 60-word cards, refreshed automatically every 2 hours, monetized via native ads and affiliate deal cards, built for search + direct + referral traffic (not just app-habit traffic).

## Origin / reference project
This project mirrors the architecture of an existing sibling project: **AI Signal Brief** (https://connectbdesi-creator.github.io/ai-signal-brief/) — a 2-hour AI news radar built on GitHub Pages + GitHub Actions cron + Telegram distribution. This project reuses that pipeline pattern but adapted for the gaming vertical, with an added interactive layer (likes/comments) that the AI Signal Brief does not have.

---

## Goals

1. Summarize video game industry news into strict 60-word cards — no exceptions, no filler.
2. Drive traffic from three channels: **search (SEO)**, **direct (repeat/habit)**, and **referral (shares)**.
3. Monetize primarily through native ad cards and gaming-specific affiliate deals (not intrusive banner ads).
4. Let users **like**, **comment**, and **click through to the original source** on every card.
5. Refresh automatically on a schedule (baseline: every 2 hours), with the ability to force-refresh during major gaming events (Nintendo Direct, State of Play, Xbox Showcase, etc.).

## Non-goals (for v1)
- Not building a native mobile app — web-first, PWA-installable.
- Not doing original journalism — this is a curation/summarization layer over existing publishers, always crediting and linking to source.
- Not building a full social network — likes/comments are lightweight engagement signals, not a full profile/follow system (yet).

---

## Core Product Decisions (finalized)

### 1. Layout: Hybrid grid + swipe (not swipe-only, not grid-only)
- **Homepage / category pages = Pinterest-style masonry grid.** This is what gets indexed by Google and browsed by first-time visitors. Uses game cover art / screenshots as the visual hook.
- **Every card also has its own real, permanent URL** (e.g. `/news/elden-ring-dlc-announced`) with unique `<title>`, meta description, and `Article` structured data (schema.org). This is what actually ranks in search — a pure infinite-swipe SPA cannot be indexed card-by-card, so this was explicitly rejected as the primary architecture.
- **Clicking into a card opens a full-screen swipeable reader** (Inshorts-style: swipe left/right or up/down to move to the next card) layered on top of the indexable page. This gives the addictive "snack through headlines" feel on top of an SEO-friendly foundation.
- Rationale: this hybrid pattern is what Flipboard, Google News, and Inshorts' own web presence effectively do — grid/list for discovery and indexing, swipe/carousel for session depth once a user is in.

### 2. Content format
- Hard cap: **60 words per summary**, rewritten in-house (not copy-pasted from source) to avoid duplicate-content SEO penalties and copyright issues.
- Every card includes: headline, 60-word summary, category tag(s), platform tag(s), source name + logo, "Read full story →" link to the original source, publish timestamp, like count, comment count.

### 3. Categories
- Releases & Launches
- Reviews (aggregated score from OpenCritic/Metacritic where available)
- Patches & Updates
- Industry & Business (layoffs, studio closures, acquisitions, earnings)
- Esports
- Deals & Sales (Steam/Epic/PSN/Xbox sale triggers — affiliate-linked)

### 4. Platform tags (filters)
PC · PlayStation · Xbox · Switch / Switch 2 · Mobile · VR

### 5. Differentiators vs. a plain Inshorts clone
- Platform-tag filtering (gaming news is platform-fragmented; AI/general news isn't).
- Spoiler-safe toggle for review/story-heavy cards.
- Release calendar widget (upcoming launches, next 2–4 weeks) — high search-intent, auto-derived from ingested data.
- Hype/sentiment signal per card (Metacritic/OpenCritic score + community discussion velocity where available).
- Deals & Sales as a first-class category with affiliate links, not just editorial news.
- Event-aware refresh: denser refresh cadence during known showcase windows (Direct, State of Play, Summer Game Fest, etc.), in addition to the standing 2-hour cron.

---

## Content Sources (initial ingestion list)

**Consumer press (RSS):** IGN, Kotaku, Polygon, GameSpot, Eurogamer, PC Gamer, Rock Paper Shotgun, VG247, GamesRadar+, VGC (Video Games Chronicle), Game Rant, TheGamer

**Platform-specific:** Nintendo Life, Push Square (PlayStation), Pure Xbox

**Official sources:** PlayStation Blog, Xbox Wire, Nintendo newsroom, Steam news hub

**Trade / industry (Business category):** GamesIndustry.biz, VentureBeat games desk

**Regional:** Automaton, Gematsu (Japanese-market coverage western outlets often miss)

**Deals data:** Steam API / SteamSpy-style price-drop feeds, Epic Games Store, affiliate networks (Instant Gaming, Eneba)

**Optional/secondary signal (not primary source, used for hype scoring only):** r/gaming, r/Games discussion velocity

---

## Monetization Plan

Reference point: Inshorts itself derives the large majority of its revenue (historically cited ~75–95%) from native advertising and sponsored cards styled like real content, not banner ads — that pattern is the model here, adapted with gaming-specific affiliate revenue layered on top.

| Stream | Description | When to turn on |
|---|---|---|
| Native ad cards | Sponsored cards visually matching news cards, clearly labeled "Sponsored" | Day 1 |
| Affiliate deal cards | Game/hardware deals linking to Steam/Epic/Instant Gaming/Eneba/Amazon | Day 1 |
| Branded partnerships | Publishers pay for a featured/pinned card around a launch | Once traffic is meaningful |
| Display ads (AdSense/Ezoic/Mediavine) | Standard programmatic ads in the grid | Once traffic clears ~10k–50k sessions/month (platform minimums) |
| Premium / ad-free tier | Subscription removes ads, adds push notifications | Once there's a loyal repeat user base worth retaining |

---

## Traffic Strategy

- **Search:** individually indexable card URLs, unique rewritten summaries (not duplicate content), Article schema markup, a release-calendar page and a deals page (both high-intent search terms).
- **Direct:** PWA install prompt, push notifications for breaking news, companion Telegram/Discord channel (same pattern as the AI Signal Brief's Telegram distribution).
- **Referral:** one-tap share to WhatsApp/X/Reddit/Discord on every card (gaming audiences over-index on Reddit/Discord shares), embeddable card widget for other sites to embed (drives backlinks).

---

## Engagement Features (like / comment / click-to-source)

- **Click-to-source:** every ingested card carries the original article's canonical URL — trivial, comes straight from the ingestion pipeline.
- **Like:** per-card like count, requires persisted per-user/per-card state → requires a real backend (see Tech Stack below); this is why the site cannot remain 100% static like the AI Signal Brief.
- **Comment:** either a custom lightweight comment system (more moderation work, more control, no third-party ads) or an embed like Giscus/Disqus (near-zero dev time; Disqus specifically carries its own ads, which can undercut this project's own ad revenue — Giscus is the safer default if going the embed route).

---

## Tech Stack (proposed)

- **Frontend:** Next.js (or Astro) in SSG/ISR mode — static-generated for SEO speed and indexability, regenerated on each ingestion cycle.
- **Ingestion pipeline:** GitHub Actions cron job (same pattern as AI Signal Brief) — pulls RSS feeds + deals data on a 2-hour schedule (plus manual/event-triggered runs), sends raw articles to Claude API for summarization (60-word cap), categorization, platform tagging, and scoring, writes structured JSON, triggers a rebuild/deploy.
- **Hosting:** production domain + real hosting (per your plan) rather than GitHub Pages, since this project needs a live backend — Vercel/Netlify (frontend + serverless functions) is a natural fit alongside the Actions ingestion pipeline.
- **Backend for interactivity:** Supabase or Firebase (free tier to start) — handles likes, comment storage, and lightweight user identity, without standing up and maintaining a dedicated server.
- **Distribution:** Telegram bot / Discord webhook for push alerts, deduplicated, same logic as the AI Signal Brief.
- **Deals ingestion:** Steam API / affiliate network feeds, normalized into the same card schema as news cards.

---

## Open Items / Next Decisions Before Development

- [ ] Finalize domain name and hosting provider
- [ ] Decide custom comment system vs. Giscus embed
- [ ] Decide affiliate networks to sign up for first (Instant Gaming / Eneba / Steam / Amazon Associates)
- [x] Design the card schema (fields: id, headline, summary, category, platform_tags[], sources[] ({name, url} — multi-outlet, clustered by the ingestion pipeline), image_url, published_at, score/hype_signal, like_count)
- [ ] Define the scoring/importance algorithm (source quality + recency + keyword signals + hype/discussion velocity)
- [ ] Set initial refresh cadence rules for showcase/event windows
- [ ] Set up analytics (for tracking search vs. direct vs. referral split from day 1)

---

## Status
Planning complete for: content format, layout architecture, categories, sources, monetization, traffic strategy, and engagement features. Next phase: technical spec finalization and repo scaffolding.
