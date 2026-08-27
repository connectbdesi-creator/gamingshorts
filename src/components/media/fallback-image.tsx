"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/**
 * Drop-in replacement for next/image that falls back to a stable
 * placeholder if the real image fails to load client-side — a source
 * outlet's CDN periodically 403s, 404s, or otherwise stops serving an
 * image URL that was valid when it was ingested (hotlink protection,
 * asset rotation, deleted articles), and there's no way to fully prevent
 * that at ingestion time. Without this, a dead URL renders as a browser's
 * broken-image icon with the headline/badges overlapping oddly on top of
 * it, since the image's box still reserves its normal space.
 */
export function FallbackImage({ alt, src, ...rest }: ImageProps) {
  const [failed, setFailed] = useState(false);
  const fallbackSrc = `https://picsum.photos/seed/${encodeURIComponent(String(src))}/800/600`;

  return <Image {...rest} alt={alt} src={failed ? fallbackSrc : src} onError={() => setFailed(true)} />;
}
