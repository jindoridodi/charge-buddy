import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { PayloadTooLargeError, requestJson } from "@/lib/server/request-json";
import { searchPlaces } from "@/lib/server/providers/nominatim";

const schema = z.object({
  name: z.string().trim().min(1).max(100), address: z.string().trim().min(1).max(200), area: z.string().trim().min(1).max(100),
  connector: z.enum(["J1772", "CCS", "NACS", "CHAdeMO"]), power_kw: z.number().finite().positive().max(1000), price: z.number().finite().positive().lt(10), published: z.boolean(),
});

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to manage listings" }, { status: 401 });
    const { data, error } = await supabase.from("peer_listings").select("*").order("name");
    if (error) throw error;
    return Response.json({ listings: data });
  } catch { return Response.json({ error: "Could not load listings" }, { status: 503 }); }
}

export async function POST(request: Request) { return save(request); }
export async function PATCH(request: Request) { return save(request); }

async function save(request: Request) {
  try {
    const body = await requestJson(request);
    const parsed = schema.safeParse(body);
    const id = request.method === "PATCH" && body && typeof body === "object" && "id" in body ? z.string().uuid().safeParse(body.id) : null;
    if (!parsed.success || (request.method === "PATCH" && !id?.success)) return Response.json({ error: "Invalid listing" }, { status: 400 });
    const { supabase, user } = await requireUser(request);
    if (!user) return Response.json({ error: "Sign in to manage listings" }, { status: 401 });
    const places = await searchPlaces(parsed.data.area);
    if (!places[0]) return Response.json({ error: "Could not find that area" }, { status: 400 });
    const listing = { ...parsed.data, latitude: places[0].location.lat, longitude: places[0].location.lng };
    const query = request.method === "PATCH" ? supabase.from("peer_listings").update(listing).eq("id", id!.data!).eq("owner_id", user.id) : supabase.from("peer_listings").insert(listing);
    const { data, error } = await query.select().maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Listing not found" }, { status: 404 });
    return Response.json({ listing: data }, { status: request.method === "POST" ? 201 : 200 });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) return Response.json({ error: error.message }, { status: 413 });
    return Response.json({ error: "Could not save listing" }, { status: 503 });
  }
}
