import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/shared/navigation-progress";
import { Toaster } from "@/components/ui/sonner";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cloutfit Rental — Find Your Perfect Look",
    template: "%s · Cloutfit Rental",
  },
  description:
    "Browse our curated collection of gowns, suits and occasion wear. Reserve your outfit in advance and book a fitting appointment online.",
  openGraph: {
    title: "Cloutfit Rental",
    description: "Elegant outfit rentals. Browse, reserve, fit, and wear.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F5EBDD",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions add attributes to <html> before React loads (e.g.
    // data-js-focus-visible). This silences that mismatch for this element only.
    <html
      lang="en"
      className={`${dmSans.variable} ${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {/* Reads the URL, so it needs its own boundary to keep pages prerenderable. */}
        <Suspense fallback={null}>
          <NavigationProgress />
        </Suspense>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
