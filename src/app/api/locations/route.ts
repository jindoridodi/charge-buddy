import { NextRequest } from "next/server";
import { searchPlaces } from "@/lib/server/providers/nominatim";
import { limitLocationRequest } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return Response.json({ places: [] });
  const rate = limitLocationRequest(request);
  if (!rate.allowed) return Response.json({ error: "Too many location searches. Try again shortly.", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try { return Response.json({ places: await searchPlaces(query) }); }
  catch (error) { return Response.json({ error: "Geocoding is unavailable. Configure the self-hosted Nominatim service.", code: error instanceof Error ? error.message : "GEOCODING_UNAVAILABLE" }, { status: 503 }); }
}
