import type { SummarizedArticle } from "../card-schema";
import type { RssSource } from "../sources";

export type MediaItem = { $?: { url?: string } };

export type FeedItem = {
  link?: string;
  title?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  mediaContent?: MediaItem[];
};

export interface Candidate {
  source: RssSource;
  item: FeedItem;
  title: string;
  link: string;
  itemId: string;
}

/** A candidate that survived classification, with its draft (single-source)
 * summary — either becomes its own card, or gets folded into a cluster. */
export interface Draft {
  candidate: Candidate;
  summary: SummarizedArticle;
  content: string;
  publishedAt: string;
}

export interface SkippedLogEntry {
  source: string;
  title: string;
  reason: string;
}

export interface MergedClusterLogEntry {
  headline: string;
  sources: string[];
  mode: "new-cluster" | "matched-existing";
}

export type ProviderBreakdown = { ollama: number; "rule-based": number };
