import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/themeInit";
import "./globals.css";

// Tells the browser both themes exist (form controls, scrollbars) and tints
// its own chrome to match whichever the device asks for.
export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f0e8d8" },
    { media: "(prefers-color-scheme: dark)", color: "#15110c" },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Explore American whiskey by distillery, style, price and rarity. Hundreds of bourbons, ryes and single malts with proof, suggested retail price and community ratings — no paid rankings.";

export const metadata: Metadata = {
  // Relative canonical / Open Graph URLs on every page resolve against this.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Common Cask — American Whiskey Explorer",
    template: "%s | Common Cask",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Common Cask — American Whiskey Explorer",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  // Only the card type: title, description and image fall back to each
  // page's Open Graph tags, so sub-pages don't inherit the home page's.
  twitter: { card: "summary_large_image" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // No canonical here on purpose: a canonical set in the root layout is
  // inherited by every page that doesn't override it, which would tell Google
  // those pages are duplicates of the home page. Each page sets its own.
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  description: DESCRIPTION,
  inLanguage: "en-US",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is set by the inline script before React hydrates, so the
    // attribute legitimately differs from the server render.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-668KYM5PL9"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-668KYM5PL9');
          `}
        </Script>
      </body>
    </html>
  );
}
