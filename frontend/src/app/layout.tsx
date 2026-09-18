import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

import { QueryProvider } from "@/lib/api/query-provider";
import { GlobalMutationOverlay } from "@/components/shell/global-mutation-overlay";
import { PageBannerNavigationListener } from "@/components/shell/page-banner-navigation-listener";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The whole app sits behind client-only OneLogin/session auth (see
// AuthGuard) and has no anonymous/cacheable content worth static
// prerendering — so there's nothing to lose by forcing every route dynamic.
// Doing it here, once, also works around an intermittent Turbopack build
// bug ("Expected workStore to be initialized") that otherwise randomly
// fails prerendering of whichever page is left in the static-generation
// worker pool (seen on both /project-health/actions and /_not-found).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Governance One",
  description:
    "Governance One — Know Early. Act Early. Deliver Better. Manage delivery governance, compliance and project health.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          {children}
          <GlobalMutationOverlay />
        </QueryProvider>
        <PageBannerNavigationListener />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
