import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";

const schema = z.object({ state: z.enum(["visible", "removed"]) });

/** Admin-only review action. Assign app_metadata.role = 'admin' in Supabase before use. */
export async function PATCH(request: Request, context: RouteContext<"/api/price-reports/[id]">) {
  try {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid review state" }, { status: 400 });
    const { supabase, user } = await requireUser(request);
    if (!user || user.app_metadata["role"] !== "admin") return Response.json({ error: "Administrator access required" }, { status: 403 });
    const { data, error } = await supabase.from("community_price_reports").update({ state: parsed.data.state }).eq("id", id).select().single();
    if (error) throw error;
    return Response.json({ report: data });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not review report" }, { status: 500 }); }
}
