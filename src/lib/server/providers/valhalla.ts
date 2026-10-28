import "server-only";
import type { Coordinates } from "@/lib/trips/types";

export const ROUTING_TIMEOUT_MS = 12_000;

function baseUrl() {
  const value = process.env["VALHALLA_URL"]?.replace(/\/$/, "");
  if (!value) throw new Error("ROUTING_NOT_CONFIGURED");
  return value;
}

async function request<T>(path: string, body: object): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl()}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`ROUTING_${response.status}`);
    return response.json() as Promise<T>;
  } finally { clearTimeout(timer); }
}

export interface RoadRoute { coordinates: Coordinates[]; miles: number; minutes: number; }

function decodePolyline6(shape: string): Coordinates[] {
  const coordinates: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < shape.length) {
    const decodeValue = () => {
      let result = 0;
      let shift = 0;
      let value: number;
      do {
        value = shape.charCodeAt(index++) - 63;
        result |= (value & 0x1f) << shift;
        shift += 5;
      } while (value >= 0x20 && index <= shape.length);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    lat += decodeValue();
    lng += decodeValue();
    coordinates.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }
  return coordinates;
}

export async function roadRoute(origin: Coordinates, destination: Coordinates): Promise<RoadRoute> {
  const response = await request<{ trip?: { summary?: { length?: number; time?: number }; legs?: { shape?: string }[] } }>("/route", { locations: [{ lat: origin.lat, lon: origin.lng }, { lat: destination.lat, lon: destination.lng }], costing: "auto", units: "miles" });
  const shape = response.trip?.legs?.[0]?.shape;
  const miles = response.trip?.summary?.length;
  const seconds = response.trip?.summary?.time;
  if (!shape || miles == null || seconds == null) throw new Error("ROUTING_INVALID_RESPONSE");
  const coordinates = decodePolyline6(shape);
  if (coordinates.length < 2) throw new Error("ROUTING_INVALID_RESPONSE");
  return { coordinates, miles, minutes: seconds / 60 };
}
