import type React from "react";
import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { AppWrapper } from "@/components/app-wrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "PayProof PIS",
  description:
    "PIS - Payment Information Service: Institutional payment intelligence layer for recording and verifying payment-related signals",
  keywords: [
    "PayProof PIS",
    "Payment Information Service",
    "Pi Network",
    "Payment Intelligence",
    "Governance",
    "Compliance",
  ],
    generator: 'v0.app'
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="PayProof PIS" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PayProof PIS" />
      </head>
      <body suppressHydrationWarning>
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
