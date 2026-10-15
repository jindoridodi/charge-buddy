import { seo } from "@/lib/seo";
import PageContent from "@/views/compare";

export const metadata = seo("Compare Chargers", "Compare up to four home EV chargers side by side on price, power and total cost.");

export default function Page() {
  return <PageContent />;
}
