export interface AffiliateStoreLink {
  name: string;
  url: string;
}

/**
 * CLAUDE.md's "Affiliate deal cards" monetization stream. There's no live
 * per-game price feed yet (that's a separate, bigger piece — real Steam
 * API / storefront ingestion), so this activates the affiliate-program
 * half of the feature now: tagged quick-shop links to each storefront,
 * shown on the Deals page. No ID/URL configured for a given store, no
 * link for it — never link out untagged, since that earns nothing.
 *
 * Amazon Associates' referral format (?tag=...) is Amazon's own stable,
 * long-documented convention, safe to build directly from just the tag.
 * Instant Gaming and Eneba's actual affiliate link formats aren't
 * something to guess at — each program hands you a ready-made tracking
 * URL when you join (via their own dashboard or a network like Awin/CJ),
 * so those two read a FULL url from env, pasted exactly as given, rather
 * than this code reconstructing one from an assumed query param.
 */
export function getAffiliateStoreLinks(): AffiliateStoreLink[] {
  const links: AffiliateStoreLink[] = [];

  const amazonTag = process.env.AMAZON_ASSOCIATES_TAG;
  if (amazonTag) {
    links.push({ name: "Amazon", url: `https://www.amazon.com/s?k=video+games&tag=${encodeURIComponent(amazonTag)}` });
  }

  const instantGamingUrl = process.env.INSTANT_GAMING_AFFILIATE_URL;
  if (instantGamingUrl) links.push({ name: "Instant Gaming", url: instantGamingUrl });

  const enebaUrl = process.env.ENEBA_AFFILIATE_URL;
  if (enebaUrl) links.push({ name: "Eneba", url: enebaUrl });

  return links;
}
