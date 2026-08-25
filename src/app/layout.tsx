import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSiteUrl } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_DESCRIPTION =
  "Video game industry news, reviews, patches, and deals summarized into 60-word cards. Refreshed every 2 hours.";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "GameShorts — Gaming News in 60 Words",
    template: "%s | GameShorts",
  },
  description: SITE_DESCRIPTION,
  alternates: {
    types: { "application/rss+xml": [{ url: "/feed.xml", title: "GameShorts RSS Feed" }] },
  },
  openGraph: {
    type: "website",
    siteName: "GameShorts",
    title: "GameShorts — Gaming News in 60 Words",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "GameShorts — Gaming News in 60 Words",
    description: SITE_DESCRIPTION,
  },
};

// Matches the manifest's background_color — dark is the only default
// theme (ThemeProvider has enableSystem={false}), so a single static
// color is correct rather than a prefers-color-scheme-based one.
export const viewport: Viewport = {
  themeColor: "#09090b",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "GameShorts",
      url: getSiteUrl(),
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "Organization",
      name: "GameShorts",
      url: getSiteUrl(),
      logo: `${getSiteUrl()}/favicon.ico`,
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={["dark", "light"]}
          enableSystem={false}
        >
          <SiteHeader />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
