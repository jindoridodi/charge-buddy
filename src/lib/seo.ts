import type { Metadata } from "next";

export function seo(title: string, description: string): Metadata {
  const fullTitle = `${title} | Charge Buddy`;
  return {
    title: fullTitle,
    description,
    openGraph: { title: fullTitle, description, type: "website" },
    twitter: { card: "summary_large_image", title: fullTitle, description },
  };
}
