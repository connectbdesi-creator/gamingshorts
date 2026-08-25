import type { Card } from "@/types/card";

/**
 * Ranks cards by discussion/engagement rather than recency: comment count
 * first (the literal "hot topic" signal), likes as the tiebreaker, then
 * hype_signal and recency after that. comment_count is only ever
 * incremented once the Giscus-backed comment system (see
 * src/components/comments/comments.tsx) is fully wired up to write back
 * into card data — until then every card ties at 0 comments and this
 * degrades gracefully to a likes/hype-ranked list instead of an empty page.
 */
export function getHotTopics(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const commentDiff = b.comment_count - a.comment_count;
    if (commentDiff !== 0) return commentDiff;
    const likeDiff = b.like_count - a.like_count;
    if (likeDiff !== 0) return likeDiff;
    const hypeDiff = (b.hype_signal ?? -1) - (a.hype_signal ?? -1);
    if (hypeDiff !== 0) return hypeDiff;
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
  });
}
