import { supabaseForRequest } from "@/lib/supabase/server";
import { catalogPriceSummary, PUBLIC_PRICE_REPORT_COLUMNS, toPublicPriceReport } from "@/lib/catalog/price";
import type { CatalogCharger, CommunityPriceReport } from "@/lib/catalog/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/chargers/[id]">) {
  try {
    const { id } = await context.params;
    const supabase = supabaseForRequest(request);
    const { data: charger, error } = await supabase.from("catalog_charger_prices").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!charger || !charger.public_access) return Response.json({ error: "Charger not found" }, { status: 404 });
    const { data: reports, error: reportError } = await supabase.from("community_price_reports").select(PUBLIC_PRICE_REPORT_COLUMNS).eq("charger_id", id).in("state", ["visible", "needs_review"]).order("observed_at", { ascending: false }).order("created_at", { ascending: false });
    if (reportError) throw reportError;
    return Response.json({ charger: { ...charger, price_summary: catalogPriceSummary(charger as CatalogCharger) }, reports: (reports ?? []).map((report) => toPublicPriceReport(report as CommunityPriceReport)) });
  } catch {
    return Response.json({ error: "Charger service is unavailable. Try again." }, { status: 503 });
  }
}
