import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

const APP_URL = "https://expert-network.vercel.app";
const TITLE = "Help&Grow Expert Network";
const DESCRIPTION =
  "Connect with Singapore's top AI, fintech, and business experts. Book advisory sessions with verified professionals.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["Singapore", "experts", "AI", "fintech", "startup", "advisory"],
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: APP_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers><main>{children}</main></Providers>
      </body>
    </html>
  );
}
