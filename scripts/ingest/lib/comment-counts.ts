import type { Card } from "@/types/card";

const GRAPHQL_URL = "https://api.github.com/graphql";
// Hard cap on pagination — 50 discussions/page, so 20 pages covers up to
// 1000 discussions per run. Plenty of headroom for how long it'll take
// this site's comment volume to get there; if it ever does, the least-
// recently-paginated discussions just wait for the next run rather than
// this query running unbounded.
const MAX_PAGES = 20;

interface DiscussionNode {
  title: string;
  comments: {
    totalCount: number;
    nodes: { replies: { totalCount: number } }[];
  };
}

/**
 * Pages through every discussion in the Giscus "Comments" category and
 * returns a Map of discussion title -> total comment count (top-level +
 * replies) — the same number Giscus itself reports client-side (see
 * comment-count-badge.tsx), computed server-side here so it can be written
 * back into data/cards.json for pages that never load the Giscus widget
 * (the homepage/category grid).
 */
async function fetchDiscussionCounts(
  owner: string,
  repo: string,
  categoryId: string,
  token: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  let after: string | null = null;

  const query = `
    query($owner: String!, $repo: String!, $categoryId: ID!, $after: String) {
      repository(owner: $owner, name: $repo) {
        discussions(categoryId: $categoryId, first: 50, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            title
            comments(first: 100) {
              totalCount
              nodes { replies { totalCount } }
            }
          }
        }
      }
    }
  `;

  for (let page = 0; page < MAX_PAGES; page++) {
    let res: Response;
    try {
      res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables: { owner, repo, categoryId, after } }),
      });
    } catch (err) {
      console.error("  ! GitHub GraphQL request failed:", (err as Error).message);
      break;
    }

    if (!res.ok) {
      console.error(`  ! GitHub GraphQL error: HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      break;
    }

    const json = await res.json();
    if (json.errors) {
      console.error("  ! GitHub GraphQL error:", JSON.stringify(json.errors).slice(0, 300));
      break;
    }

    const discussions = json.data?.repository?.discussions;
    if (!discussions) break;

    for (const node of discussions.nodes as DiscussionNode[]) {
      const replyCount = node.comments.nodes.reduce((sum: number, c) => sum + c.replies.totalCount, 0);
      counts.set(node.title, node.comments.totalCount + replyCount);
    }

    if (!discussions.pageInfo.hasNextPage) break;
    after = discussions.pageInfo.endCursor;
  }

  return counts;
}

/**
 * Refreshes every card's comment_count in place from real GitHub
 * Discussions data. Giscus's "specific" mapping (see comments.tsx) creates
 * each article's discussion with a title exactly equal to its slug, so
 * discussions are matched back to cards by title === card.slug.
 *
 * Skipped entirely (cards left unchanged) if the Giscus env vars or a
 * GitHub token aren't available — same graceful-degrade contract as the
 * rest of the ingestion pipeline (RAWG, push). In GitHub Actions,
 * GITHUB_TOKEN is provided automatically; no secret to create. Locally,
 * `pnpm ingest` simply won't sync counts unless you export a personal
 * GITHUB_TOKEN yourself.
 */
export async function syncCommentCounts(cards: Card[]): Promise<{ updated: number }> {
  const repoFull = process.env.NEXT_PUBLIC_GISCUS_REPO;
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;
  const token = process.env.GITHUB_TOKEN;

  if (!repoFull || !categoryId || !token) {
    console.log("  (skipping comment count sync — Giscus env vars or GITHUB_TOKEN not set)");
    return { updated: 0 };
  }

  const [owner, repo] = repoFull.split("/");
  if (!owner || !repo) {
    console.error(`  ! NEXT_PUBLIC_GISCUS_REPO is not in "owner/repo" form: "${repoFull}"`);
    return { updated: 0 };
  }

  const counts = await fetchDiscussionCounts(owner, repo, categoryId, token);
  let updated = 0;
  for (const card of cards) {
    const real = counts.get(card.slug);
    if (real !== undefined && real !== card.comment_count) {
      card.comment_count = real;
      updated++;
    }
  }

  return { updated };
}
