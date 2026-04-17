import type { Metadata } from "next";
import { Outfit, Pixelify_Sans } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/app-shell";
import { PwaBootstrap } from "@/components/pwa-bootstrap";
import { Toaster } from "@/components/ui/toast";
import { NotificationsScheduler } from "@/components/notifications-scheduler";

const outfit = Outfit({
  variable: "--font-sans",
  subsets: ["latin"],
});

const pixelify = Pixelify_Sans({
  variable: "--font-secondary",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Somagnus",
  description: "Segundo cerebro y productividad para medicina",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${pixelify.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <PwaBootstrap />
        <AppShell>{children}</AppShell>
        <Toaster />
        <NotificationsScheduler />
      </body>
    </html>
  );
}
