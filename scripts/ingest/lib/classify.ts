import { summarizeArticle } from "../summarize";
import type { Candidate, Draft, ProviderBreakdown, SkippedLogEntry } from "./types";

// Trims each article's RSS description before it goes into the prompt —
// most outlets' excerpts are already well under this, but a few send much
// longer ones, and none of that extra length changes a 60-word-summary
// classification call's outcome enough to be worth the extra tokens (and
// therefore extra generation time — see NUM_PREDICT in
// providers/ollama-provider.ts for the other half of this trade-off).
const MAX_CONTENT_CHARS = 400;

export interface ClassifyResult {
  drafts: Draft[];
  skippedLog: SkippedLogEntry[];
  /** Every candidate's itemId this call actually classified (draft or
   * skipped) — the caller marks all of these seen, since by the point a
   * candidate has gone through summarizeArticle it's either published (as
   * its own card or folded into a cluster) or permanently skipped; nothing
   * comes back out "unprocessed" the way an early volume-cap break used to
   * leave later candidates untouched. */
  processedItemIds: string[];
  providerBreakdown: ProviderBreakdown;
  timingMs: number;
}

/**
 * Classifies + draft-summarizes a slice of candidates (see
 * classify-shard.ts — this is what each parallel matrix job runs on its
 * own portion of the full candidate list). Clustering happens later, once
 * every shard's drafts are back together (see lib/cluster.ts) — a story
 * split across two shards has to be visible to the same clustering pass to
 * be caught, which per-shard classification alone can't do.
 */
export async function classifyCandidates(candidates: Candidate[]): Promise<ClassifyResult> {
  const startedAt = Date.now();
  const drafts: Draft[] = [];
  const skippedLog: SkippedLogEntry[] = [];
  const processedItemIds: string[] = [];
  const providerBreakdown: ProviderBreakdown = { ollama: 0, "rule-based": 0 };
  let consecutiveRuleBasedFallbacks = 0;
  let warnedOllamaDown = false;

  for (const candidate of candidates) {
    const rawContent =
      candidate.item.contentSnippet ?? candidate.item.content ?? candidate.item.summary ?? candidate.title;
    const content = rawContent.slice(0, MAX_CONTENT_CHARS);

    console.log(`- Classifying "${candidate.title}" (${candidate.source.name})`);
    const outcome = await summarizeArticle({
      title: candidate.title,
      content,
      sourceName: candidate.source.name,
    });

    processedItemIds.push(candidate.itemId);
    providerBreakdown[outcome.providerUsed]++;
    // Ollama failing outright (not "the model judged this unfit") repeats
    // identically for every remaining candidate — worth one clear warning
    // rather than a wall of identical per-candidate errors, but there's no
    // need to stop: rule-based fallback still produces a real, usable (if
    // rougher) card for every candidate.
    if (outcome.providerUsed === "rule-based") {
      consecutiveRuleBasedFallbacks++;
      if (consecutiveRuleBasedFallbacks >= 5 && !warnedOllamaDown) {
        warnedOllamaDown = true;
        console.error(
          "  ! 5 consecutive rule-based fallbacks — Ollama looks unreachable for this shard. Continuing with rule-based classification for the rest of its candidates."
        );
      }
    } else {
      consecutiveRuleBasedFallbacks = 0;
    }

    if (outcome.status === "skipped") {
      console.log(
        `  = Skipped (${outcome.reason}) via ${outcome.providerUsed}: "${candidate.title}" [${candidate.source.name}]`
      );
      skippedLog.push({ source: candidate.source.name, title: candidate.title, reason: outcome.reason });
      continue;
    }

    const publishedAt =
      candidate.item.isoDate ??
      (candidate.item.pubDate ? new Date(candidate.item.pubDate).toISOString() : new Date().toISOString());

    drafts.push({ candidate, summary: outcome.card, content, publishedAt });
  }

  return { drafts, skippedLog, processedItemIds, providerBreakdown, timingMs: Date.now() - startedAt };
}
