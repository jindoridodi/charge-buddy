import { NextRequest } from "next/server";
import { z } from "zod";
import type { CatalogCharger } from "@/lib/catalog/types";
import { catalogPriceSummary } from "@/lib/catalog/price";
import { supabaseForRequest } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const filtersSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().positive().max(100).default(15),
  maxPrice: z.coerce.number().nonnegative().max(10).default(10),
  minPower: z.coerce.number().nonnegative().max(1000).default(0),
  connectors: z.array(z.enum(["J1772", "CCS", "NACS", "CHAdeMO"])),
  levels: z.array(z.enum(["Level 1", "Level 2", "DC Fast"])),
  operational: z.enum(["true", "false"]).default("false"),
  kwh: z.coerce.number().positive().max(500).default(30),
  efficiency: z.coerce.number().positive().max(20).default(3.5),
}).refine((value) => (value.lat == null) === (value.lng == null));

function escapedSearch(value: string) {
  return value
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim()
    .replace(/[\\%_*]/g, "\\$&");
}

function positiveInteger(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 ? Math.min(parsed, maximum) : fallback;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const filters = filtersSchema.safeParse({
      lat: searchParams.get("lat") ?? undefined, lng: searchParams.get("lng") ?? undefined,
      radius: searchParams.get("radius") ?? undefined, maxPrice: searchParams.get("maxPrice") ?? undefined,
      minPower: searchParams.get("minPower") ?? undefined,
      connectors: searchParams.get("connectors")?.split(",").filter(Boolean) ?? [],
      levels: searchParams.get("levels")?.split(",").filter(Boolean) ?? [],
      operational: searchParams.get("operational") ?? undefined,
      kwh: searchParams.get("kwh") ?? undefined, efficiency: searchParams.get("efficiency") ?? undefined,
    });
    if (!filters.success) return Response.json({ error: "Provide valid catalog filters and coordinates." }, { status: 400 });
    const supabase = supabaseForRequest(request);
    const page = positiveInteger(searchParams.get("page"), 1, 10_000);
    const limit = positiveInteger(searchParams.get("limit"), 30, 100);
    const query = searchParams.get("q")?.trim();
    const safeQuery = query ? escapedSearch(query) : "";
    const f = filters.data;
    const connectors = f.connectors.flatMap((connector) => connector === "CCS" ? ["CCS", "J1772COMBO"] : connector === "NACS" ? ["NACS", "TESLA"] : connector === "CHAdeMO" ? ["CHAdeMO", "CHADEMO"] : [connector]);
    const sort = searchParams.get("sort");
    let catalog = supabase.rpc(sort === "cost" ? "search_catalog_ranked" : "search_catalog", {
      origin_lat: f.lat ?? null, origin_lng: f.lng ?? null, radius_miles: f.radius,
      connectors, levels: f.levels, max_price: f.maxPrice, min_power: f.minPower, operational: f.operational === "true",
      ...(sort === "cost" ? { requested_kwh: f.kwh, efficiency: f.efficiency } : {}),
    }, { count: "exact" });
    if (safeQuery) catalog = catalog.or(`name.ilike.*${safeQuery}*,address.ilike.*${safeQuery}*,city.ilike.*${safeQuery}*,state.ilike.*${safeQuery}*,zip.ilike.*${safeQuery}*`);
    if (sort === "price") catalog = catalog.order("effective_price_per_kwh", { ascending: true, nullsFirst: false }).order("name").order("id");
    else if (sort !== "cost") catalog = catalog.order("name").order("id");
    const { data, error, count } = await catalog.range((page - 1) * limit, page * limit - 1);
    if (error) throw error;
    const chargers = (data ?? []) as CatalogCharger[];
    return Response.json({ chargers: chargers.map((charger) => ({ ...charger, price_summary: catalogPriceSummary(charger) })), page, limit, total: count ?? 0 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load catalog" }, { status: 500 });
  }
}
