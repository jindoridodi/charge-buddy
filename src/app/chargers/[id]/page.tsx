import { seo } from "@/lib/seo";
import PageContent from "@/views/chargers.$id";

export const metadata = seo("Charger Details", "View charger information, source freshness and estimated charging costs.");

export default function Page() {
  return <PageContent />;
}
