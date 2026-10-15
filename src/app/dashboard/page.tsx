import { seo } from "@/lib/seo";
import PageContent from "@/views/dashboard";

export const metadata = seo("Dashboard", "Manage your reservations, favorites, listings and host earnings.");

export default function Page() {
  return <PageContent />;
}
