import { seo } from "@/lib/seo";
import PageContent from "@/views/list-charger";

export const metadata = seo("List Your Charger", "Share your home EV charger and earn money from local drivers.");

export default function Page() {
  return <PageContent />;
}
