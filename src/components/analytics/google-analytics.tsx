import Script from "next/script";

/**
 * GA4 (gtag.js), gated on NEXT_PUBLIC_ANALYTICS_ID rather than a hardcoded
 * measurement ID — same pattern as every other optional integration in
 * this app (Giscus, RAWG, VAPID): no-ops entirely until the env var is
 * set, instead of needing a code change to turn analytics on/off or swap
 * IDs between environments. Uses next/script's `afterInteractive` so it
 * loads after hydration instead of blocking the initial render.
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_ANALYTICS_ID;
  if (!measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}');
        `}
      </Script>
    </>
  );
}
