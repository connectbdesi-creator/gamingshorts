"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides the site's own nav/footer/install-prompt on /embed/* routes —
 * those pages are meant to be dropped into someone else's page inside an
 * iframe (CLAUDE.md's "embeddable card widget for other sites to embed"),
 * so they need to render as just the card, not a miniature copy of the
 * whole site.
 *
 * header/footer/installPrompt come in as already-rendered nodes from the
 * root layout (a Server Component) rather than being imported directly
 * here — SiteHeader/SiteFooter are Server Components that read
 * data/cards.json via node:fs (see src/lib/cards.ts), and importing a
 * Server Component's module into a "use client" file pulls it into the
 * client bundle graph, which Turbopack correctly refuses (node:fs isn't
 * bundleable for the browser). Passing pre-rendered elements as props is
 * the sanctioned way to mix a client-side pathname check with
 * server-rendered chrome.
 */
export function SiteChrome({
  header,
  footer,
  installPrompt,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  installPrompt: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isEmbed = pathname?.startsWith("/embed/");

  if (isEmbed) return <>{children}</>;

  return (
    <>
      {header}
      <main className="flex flex-1 flex-col">{children}</main>
      {footer}
      {installPrompt}
    </>
  );
}
