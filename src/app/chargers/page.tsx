import { seo } from "@/lib/seo";
import PageContent from "@/views/chargers.index";

export const metadata = seo("Find Chargers", "Browse and filter home EV chargers around San Jose on an interactive map.");

export default async function Page({ searchParams }: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  return <PageContent key={q} q={q} />;
}
