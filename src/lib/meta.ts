import fs from "node:fs";
import path from "node:path";

const META_PATH = path.join(process.cwd(), "data", "meta.json");

/**
 * ISO timestamp of the last ingestion cron run (written by
 * scripts/ingest/run.ts on every run, whether or not it found new cards),
 * for the header's "last refreshed" indicator. Null on a fresh clone or
 * before ingestion has ever run.
 */
export function getLastRefreshedAt(): string | null {
  try {
    const raw = fs.readFileSync(META_PATH, "utf8");
    const parsed = JSON.parse(raw) as { lastRunAt?: unknown };
    return typeof parsed.lastRunAt === "string" ? parsed.lastRunAt : null;
  } catch {
    return null;
  }
}
