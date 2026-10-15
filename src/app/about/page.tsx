import { seo } from "@/lib/seo";
import PageContent from "@/views/about";

export const metadata = seo("About", "Charge Buddy connects EV drivers with neighbors who share their home chargers.");

export default function Page() {
  return <PageContent />;
}
