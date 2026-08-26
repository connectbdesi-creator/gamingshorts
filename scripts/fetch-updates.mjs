#!/usr/bin/env node
// Standalone RSS -> classify/summarize -> dedupe/cluster pipeline.
//
// Deliberately separate from scripts/ingest/run.ts (the pipeline that
// actually feeds the live site's data/cards.json) — this is its own
// self-contained experiment with a different provider stack (Gemini/Groq
// instead of Anthropic/OpenRouter) and a different core philosophy: an
// AI-first primary path with a pure rule-based path as the LAST-resort
// fallback, rather than "AI or nothing" (see summarizeAndClassifyWithAI).
//
// Run: node scripts/fetch-updates.mjs   (or: pnpm fetch-updates)
// Env: GEMINI_API_KEY, GROQ_API_KEY (either/both — see README below),
//      AI_PROVIDER=gemini|groq|rule-based (optional manual override)
//
// Output (both gitignored, entirely separate from data/cards.json):
//   data/fetch-updates-output.json — the running published-card store +
//     a QC list of skipped/needs_review/failed items + a provider
//     breakdown, overwritten each run.
//   data/fetch-updates-seen.json — per-item dedup history, like the main
//     pipeline's data/seen.json but tracked independently.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import Parser from "rss-parser";

// ── Config ───────────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const OUTPUT_PATH = path.join(DATA_DIR, "fetch-updates-output.json");
const SEEN_PATH = path.join(DATA_DIR, "fetch-updates-seen.json");

const MAX_PER_SOURCE = 5;
const MAX_TOTAL = 30;
const MAX_SUMMARY_WORDS = 60;
// Kept well within Gemini's and Groq's free-tier per-minute request limits
// — this fires between every sequential AI call (classify AND cluster),
// not just once per item.
const RATE_LIMIT_DELAY_MS = 1500;
const GEMINI_RETRY_DELAY_MS = 1000;
const FETCH_TIMEOUT_MS = 20_000;
// Cross-run clustering window — a new article matching a card published
// within this window gets folded into it instead of becoming a duplicate.
const CLUSTER_WINDOW_HOURS = 48;

const CATEGORIES = [
  "releases_launches",
  "reviews",
  "patches_updates",
  "industry_business",
  "esports",
  "deals_sales",
];
const PLATFORMS = ["pc", "playstation", "xbox", "switch", "mobile", "vr"];

// gemini-2.0-flash was retired — Google's own 404 on that ID names
// gemini-3.6-flash as the direct replacement (confirmed current/GA
// against ai.google.dev's model list as of this change).
const GEMINI_MODEL = "gemini-3.6-flash";
// llama-3.3-70b-versatile still exists on Groq but moved to
// Enterprise/contact-sales pricing (confirmed via console.groq.com/docs/
// models) — a free/standard-tier key gets exactly the 404 seen here.
// gpt-oss-120b is Groq's large open model on standard self-serve pricing.
const GROQ_MODEL = "openai/gpt-oss-120b";

// Same source list as scripts/ingest/sources.ts (kept in sync manually —
// this file is intentionally dependency-free of the TS pipeline so it can
// run as plain Node with no build step).
const RSS_SOURCES = [
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
  { name: "Nintendo Life", url: "https://www.nintendolife.com/feeds/latest" },
  { name: "Push Square", url: "https://www.pushsquare.com/feeds/latest" },
  { name: "Pure Xbox", url: "https://www.purexbox.com/feeds/latest" },
  { name: "PlayStation Blog", url: "https://blog.playstation.com/feed/" },
  { name: "Xbox Wire", url: "https://news.xbox.com/en-us/feed/" },
  { name: "Steam", url: "https://store.steampowered.com/feeds/news.xml" },
  { name: "GamesIndustry.biz", url: "https://www.gamesindustry.biz/feed" },
  { name: "VentureBeat", url: "https://gamesbeat.com/feed/" },
  { name: "Automaton", url: "https://automaton-media.com/en/feed/" },
  { name: "Gematsu", url: "https://www.gematsu.com/feed" },
];

// ── Tiny .env loader (no dotenv dependency) ────────────────────────────────

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

// ── Small utilities ─────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashId(input) {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

function kebabCase(text) {
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

function slugify(headline, uniqueSeed) {
  return `${kebabCase(headline)}-${hashId(uniqueSeed)}`;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateToWordLimit(text, limit) {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

// ── Rule-based foundation (RSS fetch, keyword classification, scoring,
// word-count summarization) — this is the fallback path, used per-item
// only when both Gemini and Groq fail for that item. ────────────────────

const GAMING_KEYWORDS = [
  "game", "games", "gaming", "gamer", "gamers", "playstation", "xbox", "nintendo",
  "switch", "steam", "epic games", "esports", "dlc", "patch", "gameplay",
  "developer", "publisher", "console", "multiplayer", "single-player", "rpg",
  "fps", "mmo", "playtest", "beta", "early access", "speedrun", "modding",
];
const NON_GAMING_KEYWORDS = [
  "movie", "film", "box office", "tv show", "television series",
  "streaming series", "actor", "actress", "album", "concert", "musician",
  "theme park", "celebrity", "red carpet", "comic book",
];
const SENSITIVE_KEYWORDS = [
  "arrest", "arrested", "harassment", "harassed", "protest", "protesters",
  "nsfw", "explicit leak", "leaked nude", "sexual assault",
];

function countKeywordHits(text, keywords) {
  let hits = 0;
  for (const kw of keywords) if (text.includes(kw)) hits++;
  return hits;
}

const CATEGORY_KEYWORDS = {
  reviews: ["review", "we tested", "our verdict", "out of 10", "/10", "our rating"],
  patches_updates: ["patch", "hotfix", "patch notes", "update notes", "bug fix", "bugfix"],
  industry_business: [
    "layoffs", "acquisition", "acquired", "funding", "studio closure", "ceo",
    "earnings", "lawsuit", "ipo", "shut down", "shutting down",
  ],
  esports: ["esports", "tournament", "championship", "playoffs", "grand final", "prize pool"],
  deals_sales: ["sale", "discount", "% off", "deal", "bundle price", "price drop"],
};

function ruleBasedCategory(text) {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) return category;
  }
  return "releases_launches";
}

const PLATFORM_KEYWORDS = {
  playstation: ["playstation", "ps5", "ps4"],
  xbox: ["xbox"],
  switch: ["switch", "nintendo"],
  pc: ["steam", "epic games store", " pc "],
  mobile: ["mobile", "ios", "android"],
  vr: [" vr ", "quest 3", "psvr", "vision pro"],
};

function ruleBasedPlatforms(text) {
  const tags = [];
  for (const [platform, keywords] of Object.entries(PLATFORM_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) tags.push(platform);
  }
  return tags;
}

const HYPE_KEYWORDS = [
  "reveal", "revealed", "announce", "announced", "launch", "launches",
  "release", "released", "exclusive", "breaking", "major", "first look",
  "trailer",
];

/** Rule-based 0-100 hype estimate — deliberately simple keyword scoring,
 * used for every published card regardless of which path classified it
 * (Gemini/Groq aren't asked to produce this — see buildClassifyPrompt). */
function computeHypeScore(text) {
  const lower = text.toLowerCase();
  const hits = countKeywordHits(lower, HYPE_KEYWORDS);
  return Math.min(100, hits * 15 + 20);
}

/** Last-resort classifier — used only when Gemini AND Groq both fail for
 * a given item. Keyword-hit-count relevance/sensitivity check, keyword
 * category/platform tagging, and word-count truncation for the summary. */
function ruleBasedClassify({ title, content }) {
  const text = `${title} ${content}`.toLowerCase();
  const sensitiveHits = countKeywordHits(text, SENSITIVE_KEYWORDS);
  if (sensitiveHits > 0) {
    return { status: "needs_review", reason: "rule-based: sensitive keyword match" };
  }

  const gamingHits = countKeywordHits(text, GAMING_KEYWORDS);
  const nonGamingHits = countKeywordHits(text, NON_GAMING_KEYWORDS);
  if (gamingHits === 0 || nonGamingHits > gamingHits) {
    return { status: "skip", reason: "rule-based: insufficient gaming relevance" };
  }

  return {
    status: "publish",
    reason: null,
    headline: title,
    summary: truncateToWordLimit(content, MAX_SUMMARY_WORDS),
    category: ruleBasedCategory(text),
    platform_tags: ruleBasedPlatforms(text),
  };
}

// ── Duplicate/same-story similarity (ported from scripts/ingest/dedup.ts)

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "for", "to", "and", "with", "is",
  "are", "at", "by", "as", "from", "its", "it", "after", "over", "amid",
  "into", "new",
]);
const ABBREVIATIONS = [
  [/\bgta\b/g, "grand theft auto"],
  [/\bcod\b/g, "call of duty"],
  [/\bmgs\b/g, "metal gear solid"],
  [/\bff\b/g, "final fantasy"],
  [/\bbotw\b/g, "breath of the wild"],
  [/\btotk\b/g, "tears of the kingdom"],
];

function expandAbbreviations(title) {
  let expanded = title.toLowerCase();
  for (const [pattern, replacement] of ABBREVIATIONS) expanded = expanded.replace(pattern, replacement);
  return expanded;
}

function significantWords(title) {
  return new Set(
    expandAbbreviations(title)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

function titleSimilarity(a, b) {
  const setA = significantWords(a);
  const setB = significantWords(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SAME_STORY_THRESHOLD = 0.5;
function isSameStory(headlineA, headlineB) {
  return titleSimilarity(headlineA, headlineB) >= SAME_STORY_THRESHOLD;
}

// ── AI classification ────────────────────────────────────────────────────

function buildClassifyPrompt({ title, content, sourceName }) {
  return `You are a strict content classifier and summarizer for a video game news aggregator site.

Given the article below, decide a status:
- "publish": the article is clearly, substantively about video games — a release, review, patch/update, esports event, game industry business news, or a game storefront deal.
- "skip": the article is clearly NOT gaming news — movies, TV, comics, general pop culture, celebrity news, or a game is only mentioned in passing.
- "needs_review": the article is gaming-adjacent but involves sensitive content (arrest, harassment, protest, explicit/NSFW leaked material), OR its gaming relevance is genuinely ambiguous.

If status is "publish", also provide:
- headline: a rewritten headline in your own words (do not copy the source's title verbatim)
- summary: a rewritten, standalone summary in your own words, ${MAX_SUMMARY_WORDS} words or fewer — never copy sentences from the article
- category: exactly one of ${JSON.stringify(CATEGORIES)}
- platform_tags: an array using only values from ${JSON.stringify(PLATFORMS)} — empty array if not platform-specific

If status is "skip" or "needs_review", include a short "reason" explaining why, and set headline/summary/category to null and platform_tags to [].

Source outlet: ${sourceName}
Original headline: ${title}
Article content:
"""
${content}
"""

Respond with ONLY a single valid JSON object, no markdown formatting, no commentary, matching exactly this shape:
{"status": "publish"|"skip"|"needs_review", "reason": string|null, "headline": string|null, "summary": string|null, "category": string|null, "platform_tags": string[]}`;
}

function buildClusterPrompt(items) {
  const block = items
    .map((it, i) => `${i + 1}. [${it.sourceName}] ${it.headline}\n${it.summary}`)
    .join("\n\n");

  return `The following items appear to be covering related video game news. Decide:
- "merge": definitely the same underlying story from different outlets — provide ONE combined headline and a ${MAX_SUMMARY_WORDS}-word-or-fewer summary covering the story itself, not any single outlet's specific angle.
- "possible_duplicate": likely related but not certainly the exact same story — keep both as separate items.
- "not_related": actually distinct stories that just happen to share surface keywords or entities.

Items:
${block}

Respond with ONLY a single valid JSON object, no markdown, no commentary, matching exactly this shape:
{"decision": "merge"|"possible_duplicate"|"not_related", "headline": string|null, "summary": string|null, "reason": string}`;
}

async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json" },
      }),
    },
    FETCH_TIMEOUT_MS
  );

  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response missing text content");
  return JSON.parse(text); // throws on malformed JSON — caller catches
}

async function callGroq(prompt) {
  const res = await fetchWithTimeout(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Respond with only a single valid JSON object. No markdown, no commentary, no code fences.",
          },
          { role: "user", content: prompt },
        ],
      }),
    },
    FETCH_TIMEOUT_MS
  );

  if (!res.ok) {
    throw new Error(`Groq HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq response missing message content");
  return JSON.parse(text); // throws on malformed JSON — caller catches
}

function validateClassifyResult(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (!["publish", "skip", "needs_review"].includes(parsed.status)) return null;

  if (parsed.status !== "publish") {
    return { status: parsed.status, reason: typeof parsed.reason === "string" ? parsed.reason : "no reason given" };
  }

  if (typeof parsed.headline !== "string" || !parsed.headline.trim()) return null;
  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;
  if (!CATEGORIES.includes(parsed.category)) return null;

  const platformTags = Array.isArray(parsed.platform_tags)
    ? parsed.platform_tags.filter((p) => PLATFORMS.includes(p))
    : [];

  let summary = parsed.summary.trim();
  if (countWords(summary) > MAX_SUMMARY_WORDS) summary = truncateToWordLimit(summary, MAX_SUMMARY_WORDS);

  return {
    status: "publish",
    reason: null,
    headline: parsed.headline.trim(),
    summary,
    category: parsed.category,
    platform_tags: platformTags,
  };
}

function validateClusterResult(parsed) {
  if (!parsed || typeof parsed !== "object") return null;
  if (!["merge", "possible_duplicate", "not_related"].includes(parsed.decision)) return null;
  if (parsed.decision !== "merge") return { decision: parsed.decision, reason: parsed.reason ?? "" };

  if (typeof parsed.headline !== "string" || !parsed.headline.trim()) return null;
  if (typeof parsed.summary !== "string" || !parsed.summary.trim()) return null;

  let summary = parsed.summary.trim();
  if (countWords(summary) > MAX_SUMMARY_WORDS) summary = truncateToWordLimit(summary, MAX_SUMMARY_WORDS);

  return { decision: "merge", headline: parsed.headline.trim(), summary, reason: parsed.reason ?? "" };
}

/**
 * Classifies + summarizes one article. Primary path is AI (Gemini, retried
 * once, then Groq); the rule-based classifier only runs if both AI calls
 * fail — that's the whole point of this file vs. treating rule-based as
 * primary. AI_PROVIDER forces a single path with no further fallback, so
 * each path can be tested in isolation (a forced-path failure surfaces as
 * "failed", not silently masked by falling through).
 */
async function summarizeAndClassifyWithAI(candidate, override) {
  const prompt = buildClassifyPrompt(candidate);

  if (override === "rule-based") {
    return { ...ruleBasedClassify(candidate), providerUsed: "rule-based" };
  }

  if (!override || override === "gemini") {
    if (process.env.GEMINI_API_KEY) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const validated = validateClassifyResult(await callGemini(prompt));
          if (validated) return { ...validated, providerUsed: "gemini" };
          throw new Error("response failed shape validation");
        } catch (err) {
          console.error(`  ! Gemini classify attempt ${attempt + 1} failed: ${err.message}`);
          if (attempt === 0) await sleep(GEMINI_RETRY_DELAY_MS);
        }
      }
    } else {
      console.error("  ! GEMINI_API_KEY not set, skipping Gemini");
    }
    if (override === "gemini") return { status: "failed", reason: "gemini forced and failed", providerUsed: "gemini" };
  }

  if (!override || override === "groq") {
    if (process.env.GROQ_API_KEY) {
      try {
        const validated = validateClassifyResult(await callGroq(prompt));
        if (validated) return { ...validated, providerUsed: "groq" };
        throw new Error("response failed shape validation");
      } catch (err) {
        console.error(`  ! Groq classify failed: ${err.message}`);
      }
    } else {
      console.error("  ! GROQ_API_KEY not set, skipping Groq");
    }
    if (override === "groq") return { status: "failed", reason: "groq forced and failed", providerUsed: "groq" };
  }

  console.error("  ! Both Gemini and Groq failed/unavailable — falling back to rule-based classification");
  return { ...ruleBasedClassify(candidate), providerUsed: "rule-based" };
}

/**
 * Confirms whether two same-story-similarity items are actually the same
 * story. Only called when isSameStory() already flagged a possible match —
 * see the comment at its call site. Defaults to "possible_duplicate" (the
 * safer of the two non-merge outcomes) if every AI path fails, rather than
 * guessing at a merge.
 */
async function clusterWithAI(items, override) {
  const prompt = buildClusterPrompt(items);

  if (override === "rule-based") {
    return { decision: "possible_duplicate", reason: "rule-based mode: never auto-merges", providerUsed: "rule-based" };
  }

  if (!override || override === "gemini") {
    if (process.env.GEMINI_API_KEY) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const validated = validateClusterResult(await callGemini(prompt));
          if (validated) return { ...validated, providerUsed: "gemini" };
          throw new Error("response failed shape validation");
        } catch (err) {
          console.error(`  ! Gemini cluster-confirm attempt ${attempt + 1} failed: ${err.message}`);
          if (attempt === 0) await sleep(GEMINI_RETRY_DELAY_MS);
        }
      }
    }
    if (override === "gemini") {
      return { decision: "possible_duplicate", reason: "gemini forced and failed", providerUsed: "gemini" };
    }
  }

  if (!override || override === "groq") {
    if (process.env.GROQ_API_KEY) {
      try {
        const validated = validateClusterResult(await callGroq(prompt));
        if (validated) return { ...validated, providerUsed: "groq" };
        throw new Error("response failed shape validation");
      } catch (err) {
        console.error(`  ! Groq cluster-confirm failed: ${err.message}`);
      }
    }
    if (override === "groq") {
      return { decision: "possible_duplicate", reason: "groq forced and failed", providerUsed: "groq" };
    }
  }

  console.error("  ! Both Gemini and Groq failed for cluster confirmation — defaulting to possible_duplicate");
  return { decision: "possible_duplicate", reason: "all AI providers failed", providerUsed: "rule-based" };
}

// ── RSS fetching (rule-based, always runs — this is the shared foundation
// both the AI path and the rule-based fallback build on) ──────────────────

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 GameShortsBot/1.0",
  },
  customFields: { item: [["media:content", "mediaContent", { keepArray: true }]] },
});

function extractImage(item, seed) {
  const fromEnclosure = item.enclosure?.url;
  const fromMedia = item.mediaContent?.[0]?.$?.url;
  return fromEnclosure || fromMedia || `https://picsum.photos/seed/${seed}/800/600`;
}

async function gatherCandidates(seen) {
  const candidates = [];
  for (const source of RSS_SOURCES) {
    let feed;
    try {
      feed = await parser.parseURL(source.url);
    } catch (err) {
      console.error(`! Failed to fetch ${source.name} (${source.url}): ${err.message}`);
      continue;
    }

    let fromThisSource = 0;
    for (const item of feed.items) {
      if (fromThisSource >= MAX_PER_SOURCE) break;
      if (candidates.length >= MAX_TOTAL) break;
      const link = item.link;
      if (!link) continue;
      const itemId = hashId(link);
      if (seen.has(itemId)) continue;

      const content = item.contentSnippet ?? item.content ?? item.summary ?? item.title ?? "";
      const publishedAt = item.isoDate ?? (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString());

      candidates.push({
        itemId,
        link,
        title: item.title ?? "Untitled",
        content: content.slice(0, 3000),
        sourceName: source.name,
        imageUrl: extractImage(item, itemId),
        publishedAt,
      });
      fromThisSource++;
    }
    if (candidates.length >= MAX_TOTAL) break;
  }
  return candidates;
}

// ── Card building ─────────────────────────────────────────────────────────

function buildCard(candidate, classified, hypeSignal) {
  const id = hashId(candidate.link);
  return {
    id,
    slug: slugify(classified.headline, candidate.link),
    headline: classified.headline,
    summary: classified.summary,
    category: classified.category,
    platform_tags: classified.platform_tags,
    hype_signal: hypeSignal,
    sources: [{ name: candidate.sourceName, url: candidate.link }],
    image_url: candidate.imageUrl,
    published_at: candidate.publishedAt,
    providerUsed: classified.providerUsed,
    clusterStatus: "single",
    relatedTo: [],
  };
}

function isWithinHours(isoDate, hours) {
  return Date.now() - new Date(isoDate).getTime() <= hours * 60 * 60 * 1000;
}

// ── Main run ────────────────────────────────────────────────────────────

async function run() {
  const override = process.env.AI_PROVIDER; // "gemini" | "groq" | "rule-based" | undefined
  if (override && !["gemini", "groq", "rule-based"].includes(override)) {
    throw new Error(`AI_PROVIDER must be "gemini", "groq", or "rule-based" — got "${override}"`);
  }
  console.log(
    override
      ? `AI_PROVIDER override active: forcing "${override}" for every call (no automatic fallback).`
      : "Automatic fallback chain: gemini -> groq -> rule-based.\n"
  );

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const seen = new Set(readJson(SEEN_PATH, []));
  const existingOutput = readJson(OUTPUT_PATH, { published: [] });
  const publishedStore = existingOutput.published ?? [];

  console.log("Fetching RSS feeds...");
  const candidates = await gatherCandidates(seen);
  console.log(`Found ${candidates.length} not-yet-seen candidate(s) across ${RSS_SOURCES.length} sources.\n`);

  const breakdown = { gemini: 0, groq: 0, "rule-based": 0, publish: 0, skip: 0, needs_review: 0, failed: 0, merged: 0, possible_duplicate: 0 };
  const qc = [];
  const publishedThisRun = []; // cards accepted this run, eligible for same-run clustering

  for (const candidate of candidates) {
    console.log(`- Classifying "${candidate.title}" (${candidate.sourceName})`);
    const classified = await summarizeAndClassifyWithAI(candidate, override);
    // Only worth rate-limiting when a real API call actually happened.
    if (classified.providerUsed !== "rule-based") await sleep(RATE_LIMIT_DELAY_MS);

    breakdown[classified.providerUsed] = (breakdown[classified.providerUsed] ?? 0) + 1;
    // "failed" is transient (a forced provider was unreachable) — not
    // marked seen, so it's retried next run instead of blacklisted.
    if (classified.status !== "failed") seen.add(candidate.itemId);

    if (classified.status !== "publish") {
      breakdown[classified.status] = (breakdown[classified.status] ?? 0) + 1;
      console.log(`  = ${classified.status} (${classified.providerUsed}): ${classified.reason ?? "no reason given"}`);
      qc.push({
        status: classified.status,
        reason: classified.reason ?? null,
        providerUsed: classified.providerUsed,
        title: candidate.title,
        sourceName: candidate.sourceName,
        link: candidate.link,
        published_at: candidate.publishedAt,
      });
      continue;
    }

    breakdown.publish++;
    const hype = computeHypeScore(`${candidate.title} ${candidate.content}`);
    const card = buildCard(candidate, classified, hype);

    // Look for a possible same-story match — first among cards already
    // accepted this run, then among the persisted recent store. isSameStory
    // is a fuzzy heuristic (title-token overlap), never "fully certain" on
    // its own — every positive match here goes to clusterWithAI to confirm.
    const runMatch = publishedThisRun.find((existing) => isSameStory(card.headline, existing.headline));
    const storeMatch = !runMatch
      ? publishedStore.find(
          (existing) => isWithinHours(existing.published_at, CLUSTER_WINDOW_HOURS) && isSameStory(card.headline, existing.headline)
        )
      : null;
    const match = runMatch ?? storeMatch;

    if (match) {
      console.log(`  ~ Possible same story as "${match.headline}" — confirming with AI`);
      const clusterDecision = await clusterWithAI(
        [
          { sourceName: match.sources[0]?.name ?? "unknown", headline: match.headline, summary: match.summary },
          { sourceName: candidate.sourceName, headline: card.headline, summary: card.summary },
        ],
        override
      );
      if (clusterDecision.providerUsed !== "rule-based") await sleep(RATE_LIMIT_DELAY_MS);
      breakdown[clusterDecision.providerUsed] = (breakdown[clusterDecision.providerUsed] ?? 0) + 1;

      if (clusterDecision.decision === "merge") {
        breakdown.merged++;
        match.headline = clusterDecision.headline;
        match.summary = clusterDecision.summary;
        if (!match.sources.some((s) => s.url === card.sources[0].url)) match.sources.push(card.sources[0]);
        if (new Date(card.published_at) > new Date(match.published_at)) match.published_at = card.published_at;
        match.clusterStatus = "merged";
        console.log(`  = Merged: "${match.headline}" [${match.sources.map((s) => s.name).join(", ")}]`);
        continue; // card itself isn't added — folded into `match`
      }

      if (clusterDecision.decision === "possible_duplicate") {
        breakdown.possible_duplicate++;
        card.clusterStatus = "possible_duplicate";
        card.relatedTo = [match.id];
        match.relatedTo = [...new Set([...match.relatedTo, card.id])];
        console.log(`  = Possible duplicate of "${match.headline}" — kept separate, cross-tagged`);
      }
      // "not_related" — falls through, card added as a normal standalone card.
    }

    // Reaching this point means the card was NOT folded into an existing
    // one (that branch already `continue`d above) — whether there was no
    // match at all, or the match resolved to possible_duplicate/
    // not_related, the card is its own entry either way.
    publishedThisRun.push(card);
    publishedStore.push(card);
  }

  writeJson(SEEN_PATH, Array.from(seen));
  writeJson(OUTPUT_PATH, {
    generatedAt: new Date().toISOString(),
    breakdown,
    published: publishedStore.sort((a, b) => new Date(b.published_at) - new Date(a.published_at)),
    qc,
  });

  console.log("\n=== Run summary ===");
  console.log(`Candidates considered: ${candidates.length}`);
  console.log(`Provider usage — gemini: ${breakdown.gemini}, groq: ${breakdown.groq}, rule-based: ${breakdown["rule-based"]}`);
  console.log(
    `Outcomes — publish: ${breakdown.publish}, skip: ${breakdown.skip}, needs_review: ${breakdown.needs_review}, failed: ${breakdown.failed}`
  );
  console.log(`Clustering — merged: ${breakdown.merged}, possible_duplicate: ${breakdown.possible_duplicate}`);
  console.log(`\nFull output written to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

run().catch((err) => {
  console.error("fetch-updates run failed:", err);
  process.exit(1);
});
