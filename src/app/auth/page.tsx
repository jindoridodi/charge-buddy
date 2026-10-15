import { seo } from "@/lib/seo";
import PageContent from "@/views/auth";

export const metadata = seo("Login or Sign Up", "Sign in to reserve chargers or list your home EV charger.");

export default function Page() {
  return <PageContent />;
}
