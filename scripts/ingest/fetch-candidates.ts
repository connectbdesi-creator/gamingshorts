// Job 1 of the matrix pipeline (see .github/workflows/ingest.yml): fetches
// every RSS feed and writes the not-yet-seen candidates to data-tmp/ for
// the classify-shard matrix jobs to split up and process in parallel.
import { gatherCandidates } from "./lib/gather";
import { DEFAULT_MAX_NEW_PER_SOURCE, FORCE_REFRESH_MAX_NEW_PER_SOURCE } from "./lib/constants";
import { CANDIDATES_PATH, SEEN_PATH, readJson, writeJson } from "./lib/io";

async function main() {
  const forceRefresh = process.env.FORCE_REFRESH === "true";
  const maxPerSource = forceRefresh ? FORCE_REFRESH_MAX_NEW_PER_SOURCE : DEFAULT_MAX_NEW_PER_SOURCE;
  const baseSeen = forceRefresh ? [] : readJson<string[]>(SEEN_PATH, []);

  console.log(`Fetching RSS feeds (max ${maxPerSource} new item(s) per source)...`);
  const { candidates, timingMs, sourceErrors } = await gatherCandidates(new Set(baseSeen), maxPerSource);

  writeJson(CANDIDATES_PATH, {
    generatedAt: new Date().toISOString(),
    forceRefresh,
    maxPerSource,
    baseSeen,
    candidates,
    timing: { rssFetchMs: timingMs, sourceErrors },
  });

  console.log(
    `Found ${candidates.length} not-yet-seen candidate(s) in ${(timingMs / 1000).toFixed(1)}s (${sourceErrors} source fetch error(s)).`
  );
}

main().catch((err) => {
  console.error("fetch-candidates failed:", err);
  process.exit(1);
});
