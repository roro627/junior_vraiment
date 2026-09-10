import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { AnalyticsProvider } from "@/components/providers/analytics-provider";
import { isPublicIndexingEnabled, readAnalyticsEnvironment } from "@/lib/env";
import { resolveSiteUrl } from "@/lib/site-url";
import "@/styles/globals.css";

const geistSans = Geist({
  preload: false,
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "optional",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
  display: "optional",
});

const siteUrl = resolveSiteUrl();
const analytics = readAnalyticsEnvironment();
const publicIndexingEnabled = isPublicIndexingEnabled();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Junior, vraiment ?",
  description: "L’observatoire public du marché tech junior français.",
  applicationName: "Junior, vraiment ?",
  robots: {
    index: publicIndexingEnabled,
    follow: publicIndexingEnabled,
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Junior, vraiment ?",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {analytics.enabled ? (
          <AnalyticsProvider config={analytics}>{children}</AnalyticsProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
