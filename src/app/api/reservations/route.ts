import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { PayloadTooLargeError, requestJson } from "@/lib/server/request-json";

const bookingSchema = z.object({
  listingId: z.guid(), startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }),
  requestedKwh: z.number().finite().min(0.01).max(500),
}).strict().refine((value) => {
  const start = Date.parse(value.startsAt), duration = Date.parse(value.endsAt) - start;
  return start > Date.now() && duration >= 15 * 60_000 && duration <= 24 * 60 * 60_000;
});
const cancelSchema = z.object({ id: z.guid() }).strict();

function databaseError(error: { code?: string }) {
  if (error.code === "23P01") return Response.json({ error: "This time slot is already reserved. Choose another time." }, { status: 409 });
  if (error.code === "P0002") return Response.json({ error: "Listing or reservation is unavailable." }, { status: 404 });
  if (error.code === "23514") return Response.json({ error: "Choose a future slot of 15 minutes to 24 hours, within the charger's power. You cannot book your own listing." }, { status: 400 });
  return Response.json({ error: "Reservations are unavailable. Check the database migrations and try again." }, { status: 503 });
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to view reservations." }, { status: 401 });
    const { data, error } = await supabase.from("peer_reservations").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) return databaseError(error);
    return Response.json({ reservations: data ?? [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Could not load reservations." }, { status: 503 }); }
}

export async function POST(request: Request) { return mutate(request, false); }
export async function PATCH(request: Request) { return mutate(request, true); }

async function mutate(request: Request, cancel: boolean) {
  try {
    const body = await requestJson(request);
    const parsed = cancel ? cancelSchema.safeParse(body) : bookingSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "Provide a valid reservation and a future time slot of 15 minutes to 24 hours." }, { status: 400 });
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to reserve or cancel a charger." }, { status: 401 });
    const result = cancel
      ? await supabase.rpc("cancel_peer_reservation", { p_reservation_id: cancelSchema.parse(body).id })
      : await supabase.rpc("reserve_peer_listing", (() => {
        const value = bookingSchema.parse(body);
        return { p_listing_id: value.listingId, p_starts_at: value.startsAt, p_ends_at: value.endsAt, p_requested_kwh: value.requestedKwh };
      })());
    if (result.error) return databaseError(result.error);
    return Response.json({ reservation: result.data }, { status: cancel ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return Response.json({ error: error.message }, { status: 413 });
    return Response.json({ error: "Could not save reservation. Try again." }, { status: 503 });
  }
}
