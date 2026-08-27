"use client";

import Image, { type ImageProps } from "next/image";
import { useMemo, useState } from "react";
import { ALLOWED_IMAGE_HOSTNAMES } from "@/lib/image-hosts";

const ALLOWED_HOSTNAME_SET = new Set(ALLOWED_IMAGE_HOSTNAMES);

// Deterministic, path-safe short seed for the picsum fallback URL — the
// raw image URL can't be used directly (even encodeURIComponent'd): its
// escaped slashes/colons land inside picsum's own /seed/{here}/w/h path
// segment, which broke picsum's routing and made the *fallback* 404 too
// (confirmed via a real browser: onError fired correctly, but the
// resulting <img> still had naturalWidth 0). A short base36 hash sidesteps
// URL-safety entirely — no encoding to get wrong.
function hashSeed(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function isAllowedRemoteUrl(src: ImageProps["src"]): boolean {
  if (typeof src !== "string") return true; // a StaticImageData import — always local, always safe
  try {
    const url = new URL(src);
    // next.config.ts's remotePatterns are https-only (matching real
    // outlet CDN behavior almost universally) — an http:// URL for an
    // otherwise-allowed hostname still fails Next's own pattern match
    // (protocol is part of the pattern), so it has to be rejected here
    // too, not just the hostname.
    return url.protocol === "https:" && ALLOWED_HOSTNAME_SET.has(url.hostname);
  } catch {
    return false; // not a valid absolute URL
  }
}

/**
 * Drop-in replacement for next/image that falls back to a stable
 * placeholder in two cases:
 *  - The URL's hostname isn't in next.config.ts's image allowlist
 *    (src/lib/image-hosts.ts) — next/image doesn't fail soft here, it
 *    throws synchronously and takes down the whole page, since an
 *    unconfigured remote host is treated as a security misconfiguration,
 *    not an ordinary load failure. A new RSS source or a CDN serving from
 *    an unexpected subdomain (confirmed: IGN uses both
 *    assets-prd.ignimgs.com and assets1.ignimgs.com) can introduce one at
 *    any time.
 *  - The image genuinely fails to load client-side (a source outlet's CDN
 *    403s/404s/expires a URL after ingestion) — this renders as the
 *    browser's broken-image icon with headline/badges overlapping oddly
 *    on top of it, since the image's box still reserves its normal space.
 */
export function FallbackImage({ alt, src, ...rest }: ImageProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const configInvalid = useMemo(() => !isAllowedRemoteUrl(src), [src]);
  const fallbackSrc = `https://picsum.photos/seed/${hashSeed(String(src))}/800/600`;

  return (
    <Image
      {...rest}
      alt={alt}
      src={loadFailed || configInvalid ? fallbackSrc : src}
      onError={() => setLoadFailed(true)}
    />
  );
}
