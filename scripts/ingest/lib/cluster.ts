import type { SummarizedArticle } from "../card-schema";
import { isSameStory } from "../dedup";
import { mergeArticles } from "../summarize";
import { hashId, slugify, slugifyGameName } from "../slugify";
import { isWithinHours } from "@/lib/format";
import type { Card, CardSource } from "@/types/card";
import type { Draft, FeedItem, MergedClusterLogEntry } from "./types";

// How far back to look — among both this run's survivors and already-
// published cards — when clustering same-story coverage together.
const CLUSTER_WINDOW_HOURS = 12;

function extractImage(item: FeedItem, seed: string): string {
  const fromEnclosure = item.enclosure?.url;
  const fromMedia = item.mediaContent?.[0]?.$?.url;
  return fromEnclosure || fromMedia || `https://picsum.photos/seed/${seed}/800/600`;
}

function buildCard(
  primary: { candidate: Draft["candidate"]; summary: SummarizedArticle },
  sources: CardSource[],
  publishedAt: string,
  usedSlugs: Set<string>
): Card {
  const primaryLink = sources[0].url;
  const id = hashId(primaryLink);
  const slug = slugify(primary.summary.headline, usedSlugs);
  usedSlugs.add(slug);

  return {
    id,
    slug,
    headline: primary.summary.headline,
    summary: primary.summary.summary,
    category: primary.summary.category,
    platform_tags: primary.summary.platform_tags,
    sources,
    image_url: extractImage(primary.candidate.item, id),
    published_at: publishedAt,
    hype_signal: primary.summary.hype_signal,
    like_count: 0,
    comment_count: 0,
    game: primary.summary.game_label ? slugifyGameName(primary.summary.game_label) : null,
    game_label: primary.summary.game_label,
  };
}

export interface ClusterResult {
  newCards: Card[];
  mergedClustersLog: MergedClusterLogEntry[];
  timingMs: number;
}

/**
 * Clusters every draft from every shard (must see the FULL merged set —
 * two articles about the same story can land in different matrix shards
 * during classification, see lib/classify.ts) against already-published
 * recent cards, then against each other, then builds the final Card for
 * every resulting cluster. Purely rule-based matching (dedup.ts's
 * isSameStory) — the only remaining AI call in this phase is
 * mergeArticles(), and only for a cluster with more than one draft (rare;
 * most drafts are standalone stories and never call it).
 */
export async function clusterAndBuildCards(
  drafts: Draft[],
  existingCards: Card[]
): Promise<ClusterResult> {
  const startedAt = Date.now();
  const mergedClustersLog: MergedClusterLogEntry[] = [];

  // First, fold any draft that covers the same story as an already-
  // published recent card into that card's `sources` instead of creating a
  // new one.
  const existingRecent = existingCards.filter((c) => isWithinHours(c.published_at, CLUSTER_WINDOW_HOURS));
  const unmatchedDrafts: Draft[] = [];

  for (const draft of drafts) {
    const match = existingRecent.find((c) =>
      isSameStory(
        { headline: draft.candidate.title, gameLabel: draft.summary.game_label },
        { headline: c.headline, gameLabel: c.game_label }
      )
    );

    if (match) {
      const alreadyCredited = match.sources.some((s) => s.url === draft.candidate.link);
      if (!alreadyCredited) match.sources.push({ name: draft.candidate.source.name, url: draft.candidate.link });
      if (new Date(draft.publishedAt).getTime() > new Date(match.published_at).getTime()) {
        match.published_at = draft.publishedAt;
      }
      console.log(`  = Merged into existing card (+${draft.candidate.source.name}): "${match.headline}"`);
      mergedClustersLog.push({
        headline: match.headline,
        sources: match.sources.map((s) => s.name),
        mode: "matched-existing",
      });
      continue;
    }

    unmatchedDrafts.push(draft);
  }

  // Then greedily group the remaining this-run drafts among themselves.
  // Small N per run, so an O(n^2) pass is fine — not worth a smarter
  // clustering algorithm for this volume.
  const clusters: Draft[][] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < unmatchedDrafts.length; i++) {
    if (consumed.has(i)) continue;
    const group = [unmatchedDrafts[i]];
    consumed.add(i);

    for (let j = i + 1; j < unmatchedDrafts.length; j++) {
      if (consumed.has(j)) continue;
      const matchesGroup = group.some((g) =>
        isSameStory(
          { headline: g.candidate.title, gameLabel: g.summary.game_label },
          { headline: unmatchedDrafts[j].candidate.title, gameLabel: unmatchedDrafts[j].summary.game_label }
        )
      );
      if (matchesGroup) {
        group.push(unmatchedDrafts[j]);
        consumed.add(j);
      }
    }

    clusters.push(group);
  }

  // Turn each cluster into its final card — a single-draft cluster is
  // already a finished card, a multi-draft cluster gets one combined
  // summary via mergeArticles().
  const usedSlugs = new Set<string>(existingCards.map((c) => c.slug));
  const newCards: Card[] = [];
  for (const group of clusters) {
    if (group.length === 1) {
      const draft = group[0];
      newCards.push(
        buildCard(
          draft,
          [{ name: draft.candidate.source.name, url: draft.candidate.link }],
          draft.publishedAt,
          usedSlugs
        )
      );
      continue;
    }

    const sortedByTime = [...group].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
    const primaryDraft = sortedByTime[0];
    const latestPublishedAt = sortedByTime[sortedByTime.length - 1].publishedAt;
    const sources: CardSource[] = group.map((d) => ({ name: d.candidate.source.name, url: d.candidate.link }));

    console.log(
      `- Merging ${group.length} articles into one card: ${group.map((d) => `"${d.candidate.title}" (${d.candidate.source.name})`).join("; ")}`
    );
    const merged = await mergeArticles(
      group.map((d) => ({ title: d.candidate.title, content: d.content, sourceName: d.candidate.source.name }))
    );

    if (merged) {
      newCards.push(
        buildCard({ candidate: primaryDraft.candidate, summary: merged }, sources, latestPublishedAt, usedSlugs)
      );
      console.log(`  = Merged card: "${merged.headline}" [${sources.map((s) => s.name).join(", ")}]`);
      mergedClustersLog.push({
        headline: merged.headline,
        sources: sources.map((s) => s.name),
        mode: "new-cluster",
      });
    } else {
      // Merge call failed — publish each individually rather than losing
      // valid gaming news over an LLM hiccup.
      console.error(`  ! Merge call failed for cluster, publishing ${group.length} articles separately`);
      for (const d of group) {
        newCards.push(
          buildCard(d, [{ name: d.candidate.source.name, url: d.candidate.link }], d.publishedAt, usedSlugs)
        );
      }
    }
  }

  return { newCards, mergedClustersLog, timingMs: Date.now() - startedAt };
}
