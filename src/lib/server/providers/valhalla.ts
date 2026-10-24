import "server-only";
import type { Coordinates } from "@/lib/trips/types";

const timeoutMs = 12_000;

function baseUrl() {
  const value = process.env["VALHALLA_URL"]?.replace(/\/$/, "");
  if (!value) throw new Error("ROUTING_NOT_CONFIGURED");
  return value;
}

async function request<T>(path: string, body: object): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl()}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`ROUTING_${response.status}`);
    return response.json() as Promise<T>;
  } finally { clearTimeout(timer); }
}

export interface RoadRoute { coordinates: Coordinates[]; miles: number; minutes: number; }

export async function roadRoute(origin: Coordinates, destination: Coordinates): Promise<RoadRoute> {
  const response = await request<{ trip?: { summary?: { length?: number; time?: number }; legs?: { shape?: string }[] } }>("/route", { locations: [{ lat: origin.lat, lon: origin.lng }, { lat: destination.lat, lon: destination.lng }], costing: "auto", units: "miles", shape_format: "geojson" });
  const shape = response.trip?.legs?.[0]?.shape;
  const coordinates = shape ? JSON.parse(shape).coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) : [];
  const miles = response.trip?.summary?.length;
  const seconds = response.trip?.summary?.time;
  if (!shape || miles == null || seconds == null) throw new Error("ROUTING_INVALID_RESPONSE");
  return { coordinates, miles, minutes: seconds / 60 };
}
