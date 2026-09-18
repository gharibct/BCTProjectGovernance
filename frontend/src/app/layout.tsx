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
