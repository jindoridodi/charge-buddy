import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { PUBLIC_PRICE_REPORT_COLUMNS, toPublicPriceReport } from "@/lib/catalog/price";
import type { CommunityPriceReport } from "@/lib/catalog/types";

const schema = z.object({ pricePerKwh: z.number().positive().lt(10), observedAt: z.string().date(), note: z.string().max(500).optional() });

export async function POST(request: Request, context: RouteContext<"/api/chargers/[id]/price-reports">) {
  try {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Provide a valid USD/kWh price and observed date" }, { status: 400 });
    if (parsed.data.observedAt > new Date().toISOString().slice(0, 10)) return Response.json({ error: "Observed date cannot be in the future" }, { status: 400 });
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to report a price" }, { status: 401 });
    const { data, error } = await supabase.from("community_price_reports").insert({ charger_id: id, reporter_id: user.id, price_per_kwh: parsed.data.pricePerKwh, observed_at: parsed.data.observedAt, note: parsed.data.note?.trim() || null }).select(PUBLIC_PRICE_REPORT_COLUMNS).single();
    if (error?.code === "23505") return Response.json({ error: "You have already reported a price for this charger on that date" }, { status: 409 });
    if (error) throw error;
    return Response.json({ report: toPublicPriceReport(data as CommunityPriceReport) }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not submit price" }, { status: 500 }); }
}
