import type { Metadata } from "next";

import { Footer } from "@/components/Footer";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI PM Radar",
  description:
    "Static daily AI and business radar for non-technical AI PM learners, NGO practitioners, and SME decision-makers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Footer />
      </body>
    </html>
  );
}
