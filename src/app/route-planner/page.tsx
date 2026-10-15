import { seo } from "@/lib/seo";
import PageContent from "@/views/route-planner";

export const metadata = seo("Route Planner", "Plan an EV trip and find affordable home chargers along the way.");

export default function Page() {
  return <PageContent />;
}
