import { NextRequest } from "next/server";
import { priceSummary, orderByPrice } from "@/lib/catalog/price";
import type { CatalogCharger, CommunityPriceReport } from "@/lib/catalog/types";
import { supabaseForRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseForRequest(request);
    const { searchParams } = request.nextUrl;
    const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30), 1), 100);
    const query = searchParams.get("q")?.trim();
    let catalog = supabase.from("chargers").select("*", { count: "exact" }).order("name").range((page - 1) * limit, page * limit - 1);
    if (query) catalog = catalog.or(`name.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%,state.ilike.%${query}%,zip.ilike.%${query}%`);
    const { data, error, count } = await catalog;
    if (error) throw error;
    const chargers = (data ?? []) as CatalogCharger[];
    const ids = chargers.map((c) => c.id);
    const { data: reports, error: reportError } = ids.length
      ? await supabase.from("community_price_reports").select("*").in("charger_id", ids).in("state", ["visible", "needs_review"])
      : { data: [], error: null };
    if (reportError) throw reportError;
    const grouped = new Map<string, CommunityPriceReport[]>();
    for (const report of (reports ?? []) as CommunityPriceReport[]) grouped.set(report.charger_id, [...(grouped.get(report.charger_id) ?? []), report]);
    const result = chargers.map((charger) => ({ ...charger, price_summary: priceSummary(grouped.get(charger.id) ?? []) }));
    const sort = searchParams.get("sort");
    const ordered = sort === "price" || sort === "total" ? orderByPrice(result) : result;
    return Response.json({ chargers: ordered, page, limit, total: count ?? 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load catalog" }, { status: 500 });
  }
}
