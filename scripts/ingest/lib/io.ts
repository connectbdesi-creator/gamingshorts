import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const CARDS_PATH = path.join(DATA_DIR, "cards.json");
export const SEEN_PATH = path.join(DATA_DIR, "seen.json");
export const GAMES_PATH = path.join(DATA_DIR, "games.json");
export const META_PATH = path.join(DATA_DIR, "meta.json");
// QC-only artifact for spot-checking the classifier/clustering — never
// committed (see .gitignore), overwritten fresh every run. Uploaded as a
// GitHub Actions artifact by the workflow so it's still inspectable
// without a local run.
export const LOG_PATH = path.join(DATA_DIR, "ingestion-log.json");

// Inter-job staging area for the GitHub Actions matrix pipeline (see
// ingest.yml): fetch-candidates.ts writes candidates.json here, each
// classify-shard.ts matrix job writes its own shard-N.json, and
// merge-and-publish.ts reads all of them back. Gitignored, and irrelevant
// for a local `pnpm ingest` run (which never leaves this directory —
// run.ts calls the same lib functions in-process instead).
export const DATA_TMP_DIR = path.join(process.cwd(), "data-tmp");
export const CANDIDATES_PATH = path.join(DATA_TMP_DIR, "candidates.json");
export function shardResultPath(index: number): string {
  return path.join(DATA_TMP_DIR, `shard-${index}.json`);
}

export function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
