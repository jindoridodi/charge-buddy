import { supabaseForRequest } from "@/lib/supabase/server";
import { priceSummary } from "@/lib/catalog/price";
import type { CommunityPriceReport } from "@/lib/catalog/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/chargers/[id]">) {
  try {
    const { id } = await context.params;
    const supabase = supabaseForRequest(request);
    const { data: charger, error } = await supabase.from("chargers").select("*").eq("id", id).single();
    if (error || !charger) return Response.json({ error: "Charger not found" }, { status: 404 });
    const { data: reports, error: reportError } = await supabase.from("community_price_reports").select("*").eq("charger_id", id).in("state", ["visible", "needs_review"]).order("observed_at", { ascending: false }).order("created_at", { ascending: false });
    if (reportError) throw reportError;
    return Response.json({ charger: { ...charger, price_summary: priceSummary((reports ?? []) as CommunityPriceReport[]) }, reports: reports ?? [] });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load charger" }, { status: 500 });
  }
}
