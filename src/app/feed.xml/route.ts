import { getAllCards } from "@/lib/cards";
import { formatSourceNames } from "@/lib/format";
import { getSiteUrl } from "@/lib/site";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const revalidate = 7200;

export function GET() {
  const base = getSiteUrl();
  const cards = getAllCards().slice(0, 50);

  const items = cards
    .map((card) => {
      const url = `${base}/news/${card.slug}`;
      return `
    <item>
      <title>${escapeXml(card.headline)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(card.published_at).toUTCString()}</pubDate>
      <description>${escapeXml(card.summary)}</description>
      <category>${escapeXml(card.category)}</category>
      <source url="${escapeXml(card.sources[0].url)}">${escapeXml(formatSourceNames(card.sources))}</source>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>GameShorts</title>
    <link>${base}</link>
    <description>Video game industry news, reviews, patches, and deals summarized into 60-word cards.</description>
    <language>en</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
