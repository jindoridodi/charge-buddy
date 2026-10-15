import { seo } from "@/lib/seo";
import PageContent from "@/views/index";

export const metadata = seo("Your Next Charge Is Closer Than You Think", "Discover affordable EV charging nearby or earn money by sharing your home charger.");

export default function Page() {
  return <PageContent />;
}
