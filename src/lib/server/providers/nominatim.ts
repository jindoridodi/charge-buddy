import "server-only";
import type { Coordinates } from "@/lib/trips/types";
import { z } from "zod";

export interface PlaceResult { id: string; label: string; location: Coordinates; }

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const key = process.env["STADIA_MAPS_API_KEY"]?.trim();
  if (key) return searchStadia(query, key);
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

async function searchStadia(query: string, key: string): Promise<PlaceResult[]> {
  const url = new URL("https://api.stadiamaps.com/geocoding/v1/search");
  url.search = new URLSearchParams({ text: query, "boundary.country": "USA", size: "5" }).toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, { headers: { accept: "application/json", authorization: `Stadia-Auth ${key}` }, signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`GEOCODING_${response.status}`);
    const feature = z.object({ geometry: z.object({ type: z.literal("Point"), coordinates: z.tuple([z.number().finite().gte(-180).lte(180), z.number().finite().gte(-90).lte(90)]) }), properties: z.object({ gid: z.string().min(1), label: z.string().min(1) }) });
    const parsed = z.object({ features: z.array(feature) }).safeParse(await response.json());
    if (!parsed.success) throw new Error("GEOCODING_INVALID_RESPONSE");
    return parsed.data.features.map(({ geometry, properties }) => ({ id: properties.gid, label: properties.label, location: { lat: geometry.coordinates[1], lng: geometry.coordinates[0] } }));
  } finally { clearTimeout(timer); }
}
