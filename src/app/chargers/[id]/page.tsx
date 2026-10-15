import { seo } from "@/lib/seo";
import PageContent from "@/views/chargers.$id";

export const metadata = seo("Charger Details", "View photos, pricing, reviews and book this home EV charger.");

export default function Page() {
  return <PageContent />;
}
