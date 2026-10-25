import { NextRequest } from "next/server";
import type { CatalogCharger, PriceSummary } from "@/lib/catalog/types";
import { supabaseForRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function escapedSearch(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim()
    .replace(/[\\%_*]/g, "\\$&");
}

function catalogPriceSummary(charger: CatalogCharger): PriceSummary {
  return charger.community_price_per_kwh != null && charger.community_price_observed_at != null
    ? { status: "community", price_per_kwh: Number(charger.community_price_per_kwh), observed_at: charger.community_price_observed_at }
    : { status: "unknown", price_per_kwh: null, observed_at: null };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = supabaseForRequest(request);
    const { searchParams } = request.nextUrl;
    const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 30), 1), 100);
    const query = searchParams.get("q")?.trim();
    const safeQuery = query ? escapedSearch(query) : "";
    let catalog = supabase.from("catalog_charger_prices").select("*", { count: "exact" }).eq("public_access", true);
    if (safeQuery) catalog = catalog.or(`name.ilike.*${safeQuery}*,address.ilike.*${safeQuery}*,city.ilike.*${safeQuery}*,state.ilike.*${safeQuery}*,zip.ilike.*${safeQuery}*`);
    const sort = searchParams.get("sort");
    catalog = sort === "price"
      ? catalog.order("community_price_per_kwh", { ascending: true, nullsFirst: false }).order("name")
      : catalog.order("name");
    const { data, error, count } = await catalog.range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    const chargers = (data ?? []) as CatalogCharger[];
    return Response.json({ chargers: chargers.map((charger) => ({ ...charger, price_summary: catalogPriceSummary(charger) })), page, limit, total: count ?? 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load catalog" }, { status: 500 });
  }
}
