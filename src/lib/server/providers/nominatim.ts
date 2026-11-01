import "server-only";
import type { Coordinates } from "@/lib/trips/types";

export interface PlaceResult { id: string; label: string; location: Coordinates; }

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const base = process.env["NOMINATIM_URL"]?.replace(/\/$/, "");
  if (!base) throw new Error("GEOCODING_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${base}/search?format=jsonv2&limit=5&countrycodes=us&q=${encodeURIComponent(query)}`, { headers: { accept: "application/json" }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`GEOCODING_${response.status}`);
    const results = await response.json() as { place_id: number; display_name: string; lat: string; lon: string }[];
    return results.map((result) => ({ id: String(result.place_id), label: result.display_name, location: { lat: Number(result.lat), lng: Number(result.lon) } })).filter((result) => Number.isFinite(result.location.lat) && Number.isFinite(result.location.lng));
  } finally { clearTimeout(timer); }
}
