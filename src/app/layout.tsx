import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "../styles.css";

export const metadata: Metadata = {
  title: "Charge Buddy — Peer-to-Peer EV Charging",
  description: "Find affordable home EV chargers nearby or earn money sharing yours.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@600;700;800&display=swap" />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
