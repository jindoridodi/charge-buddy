import { NextRequest } from "next/server";
import { searchPlaces } from "@/lib/server/providers/nominatim";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) return Response.json({ places: [] });
  try { return Response.json({ places: await searchPlaces(query) }); }
  catch (error) { return Response.json({ error: "Geocoding is unavailable. Configure the self-hosted Nominatim service.", code: error instanceof Error ? error.message : "GEOCODING_UNAVAILABLE" }, { status: 503 }); }
}
