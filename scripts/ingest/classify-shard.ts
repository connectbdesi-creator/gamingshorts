// Job 2 of the matrix pipeline (see .github/workflows/ingest.yml): one of
// N parallel runners, each taking an even slice of the candidates written
// by fetch-candidates.ts and classifying/summarizing just that slice
// against its own local Ollama instance. Clustering is deliberately NOT
// done here — it needs the full merged candidate set to catch a story
// split across two shards (see merge-and-publish.ts).
import type { Candidate } from "./lib/types";
import { classifyCandidates } from "./lib/classify";
import { CANDIDATES_PATH, readJson, shardResultPath, writeJson } from "./lib/io";

function requireIntEnv(name: string): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : NaN;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be set to a non-negative integer, got "${raw}"`);
  }
  return value;
}

async function main() {
  const shardIndex = requireIntEnv("SHARD_INDEX");
  const shardTotal = requireIntEnv("SHARD_TOTAL");
  if (shardIndex >= shardTotal) {
    throw new Error(`SHARD_INDEX (${shardIndex}) must be less than SHARD_TOTAL (${shardTotal})`);
  }

  const { candidates } = readJson<{ candidates: Candidate[] }>(CANDIDATES_PATH, { candidates: [] });
  const slice = candidates.filter((_, i) => i % shardTotal === shardIndex);

  console.log(`Shard ${shardIndex}/${shardTotal}: classifying ${slice.length} of ${candidates.length} candidate(s)\n`);
  const result = await classifyCandidates(slice);

  writeJson(shardResultPath(shardIndex), {
    shardIndex,
    shardTotal,
    candidateCount: slice.length,
    ...result,
  });

  console.log(
    `\nShard ${shardIndex} done in ${(result.timingMs / 1000).toFixed(1)}s — ${result.drafts.length} draft(s), ${result.skippedLog.length} skipped. Provider usage — ollama: ${result.providerBreakdown.ollama}, rule-based: ${result.providerBreakdown["rule-based"]}.`
  );
}

main().catch((err) => {
  console.error("classify-shard failed:", err);
  process.exit(1);
});
