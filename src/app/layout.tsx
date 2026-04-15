import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// .trim() guards against stray whitespace in the Vercel env var, which was
// producing "\thttps://commoncask.com" in canonical tags and JSON-LD URLs.
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://commoncask.com").trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Common Cask — American Whiskey Explorer",
    template: "%s | Common Cask",
  },
  description:
    "Explore and discover American whiskey. Browse hundreds of bourbons, ryes, and craft whiskeys from distilleries across the US — rated and reviewed by the community.",
  keywords: [
    "bourbon",
    "rye whiskey",
    "American whiskey",
    "whiskey catalog",
    "craft distillery",
    "whiskey ratings",
    "bourbon guide",
    "Kentucky bourbon",
    "single barrel bourbon",
  ],
  authors: [{ name: "Common Cask" }],
  creator: "Common Cask",
  openGraph: {
    type: "website",
    siteName: "Common Cask",
    title: "Common Cask — American Whiskey Explorer",
    description:
      "Explore and discover American whiskey. Browse hundreds of bourbons, ryes, and craft whiskeys from distilleries across the US.",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Common Cask — American Whiskey Explorer",
    description:
      "Explore and discover American whiskey. Browse hundreds of bourbons, ryes, and craft whiskeys from distilleries across the US.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Common Cask",
  url: SITE_URL,
  description:
    "Explore and discover American whiskey. Browse hundreds of bourbons, ryes, and craft whiskeys from distilleries across the US — rated and reviewed by the community.",
  inLanguage: "en-US",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
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
