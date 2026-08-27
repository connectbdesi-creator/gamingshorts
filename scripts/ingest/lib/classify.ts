import { ruleBasedClassify } from "../rule-based";
import { summarizeArticle } from "../summarize";
import type { Candidate, Draft, ProviderBreakdown, SkippedLogEntry } from "./types";

// Trims each article's RSS description before it goes into the prompt —
// most outlets' excerpts are already well under this, but a few send much
// longer ones, and none of that extra length changes a 60-word-summary
// classification call's outcome enough to be worth the extra tokens (and
// therefore extra generation time — see NUM_PREDICT in
// providers/ollama-provider.ts for the other half of this trade-off).
const MAX_CONTENT_CHARS = 400;

// Self-imposed wall-clock budget for a shard's classification loop —
// exists because the alternative is worse: GitHub Actions' own
// timeout-minutes (ingest.yml) kills the whole job from the outside,
// which discards every candidate this shard already classified (the
// "Upload shard results" step never runs on a cancelled job). A shard hit
// this in practice: Ollama was inconsistently slow across otherwise-
// identical parallel runners, and one shard's classify step got killed
// after ~14 minutes of real, lost work while a same-sized sibling shard
// finished in 2 seconds. Once this budget is spent, remaining candidates
// in the slice classify via the rule-based fallback (instant, no network
// call) instead of Ollama, so the shard always finishes and uploads
// something well inside the external timeout — degrading gracefully to
// rougher classifications under load instead of losing a run's work
// entirely. Comfortably under the classify job's 18-minute cap (ingest.yml)
// once ~1-1.5 minutes of Ollama install/cache/server-start overhead (which
// happens before this function is even called) is accounted for.
const DEFAULT_SHARD_DEADLINE_MS = 12 * 60 * 1000;

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
export async function classifyCandidates(
  candidates: Candidate[],
  deadlineMs: number = DEFAULT_SHARD_DEADLINE_MS
): Promise<ClassifyResult> {
  const startedAt = Date.now();
  const drafts: Draft[] = [];
  const skippedLog: SkippedLogEntry[] = [];
  const processedItemIds: string[] = [];
  const providerBreakdown: ProviderBreakdown = { ollama: 0, "rule-based": 0 };
  let consecutiveRuleBasedFallbacks = 0;
  let warnedOllamaDown = false;
  let deadlinePassed = false;

  for (const candidate of candidates) {
    // `??` alone isn't enough here — it only skips null/undefined, not an
    // RSS item whose contentSnippet/content/summary is a defined-but-empty
    // string (a real, observed case), which locked in "" as the article
    // content and produced a card with an empty summary end to end. Every
    // field before `title` here can legitimately be empty; `title` is the
    // one guaranteed non-empty value (see lib/gather.ts's `?? "Untitled"`).
    const rawContent =
      [candidate.item.contentSnippet, candidate.item.content, candidate.item.summary, candidate.title].find(
        (v) => v && v.trim()
      ) ?? candidate.title;
    const content = rawContent.slice(0, MAX_CONTENT_CHARS);

    if (!deadlinePassed && Date.now() - startedAt >= deadlineMs) {
      deadlinePassed = true;
      console.error(
        `  ! Shard deadline (${(deadlineMs / 60000).toFixed(1)}min) reached — classifying the rest of this shard's candidates rule-based only, to guarantee this shard finishes and uploads results.`
      );
    }

    console.log(`- Classifying "${candidate.title}" (${candidate.source.name})`);
    const outcome = deadlinePassed
      ? ruleBasedClassify({ title: candidate.title, content })
      : await summarizeArticle({
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
