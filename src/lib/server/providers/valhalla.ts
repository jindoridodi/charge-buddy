import "server-only";
import { z } from "zod";
import type { Coordinates } from "@/lib/trips/types";

export const ROUTING_TIMEOUT_MS = 12_000;

export class RoutingLocationError extends Error {
  constructor(readonly code: number) { super("No drivable route connects these locations. Try points near connected roads within the routing service's coverage."); }
}

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
    if (!response.ok) {
      if (response.status === 400) {
        const error = await response.json().catch(() => null) as { error_code?: number } | null;
        if (error?.error_code != null && [170, 171, 172, 442].includes(error.error_code)) throw new RoutingLocationError(error.error_code);
      }
      throw new Error(`ROUTING_${response.status}`);
    }
    return await response.json() as T;
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
        if (index >= shape.length || shift >= 30) throw new Error("ROUTING_INVALID_RESPONSE");
        value = shape.charCodeAt(index++) - 63;
        if (value < 0 || value > 63) throw new Error("ROUTING_INVALID_RESPONSE");
        result |= (value & 0x1f) << shift;
        shift += 5;
      } while (value >= 0x20 && index <= shape.length);
      return result & 1 ? ~(result >> 1) : result >> 1;
    };
    lat += decodeValue();
    lng += decodeValue();
    if (Math.abs(lat) > 90e6 || Math.abs(lng) > 180e6) throw new Error("ROUTING_INVALID_RESPONSE");
    coordinates.push({ lat: lat / 1e6, lng: lng / 1e6 });
  }
  return coordinates;
}

export async function roadRoute(origin: Coordinates, destination: Coordinates): Promise<RoadRoute> {
  const response = await request<unknown>("/route", { locations: [{ lat: origin.lat, lon: origin.lng }, { lat: destination.lat, lon: destination.lng }], costing: "auto", units: "miles" });
  const parsed = z.object({ trip: z.object({ summary: z.object({ length: z.number().finite().nonnegative(), time: z.number().finite().nonnegative() }), legs: z.array(z.object({ shape: z.string().min(1) })).min(1) }) }).safeParse(response);
  if (!parsed.success) throw new Error("ROUTING_INVALID_RESPONSE");
  const shape = parsed.data.trip.legs[0]!.shape;
  const { length: miles, time: seconds } = parsed.data.trip.summary;
  const coordinates = decodePolyline6(shape);
  if (coordinates.length < 2) throw new Error("ROUTING_INVALID_RESPONSE");
  return { coordinates, miles, minutes: seconds / 60 };
}
