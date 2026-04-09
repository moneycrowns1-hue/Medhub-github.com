import type { Metadata } from "next";
import { Outfit, Pixelify_Sans } from "next/font/google";
import "./globals.css";

import { AppShell } from "@/components/app-shell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
