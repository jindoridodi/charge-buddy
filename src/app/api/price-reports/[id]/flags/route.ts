import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";

const schema = z.object({ reason: z.string().trim().min(1).max(280) });

export async function POST(request: Request, context: RouteContext<"/api/price-reports/[id]/flags">) {
  try {
    const { id } = await context.params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Provide a flag reason" }, { status: 400 });
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to flag a report" }, { status: 401 });
    const { data, error } = await supabase.from("price_report_flags").insert({ report_id: id, reporter_id: user.id, reason: parsed.data.reason }).select().single();
    if (error?.code === "23505") return Response.json({ error: "You have already flagged this report" }, { status: 409 });
    if (error) throw error;
    return Response.json({ flag: data }, { status: 201 });
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Could not flag report" }, { status: 500 }); }
}
