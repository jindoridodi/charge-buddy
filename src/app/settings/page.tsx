import { seo } from "@/lib/seo";
import PageContent from "@/views/settings";

export const metadata = seo("Settings", "Manage your profile, vehicles, charging preferences and notifications.");

export default function Page() {
  return <PageContent />;
}
