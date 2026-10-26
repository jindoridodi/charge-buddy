import { NextRequest } from "next/server";
import { z } from "zod";
import { createTrip } from "@/lib/server/trips";
import { limitTripRequest } from "@/lib/server/rate-limit";
import { vehicleById } from "@/lib/trips/vehicles";

export const dynamic = "force-dynamic";

const coordinate = z.object({ lat: z.number().gte(-90).lte(90), lng: z.number().gte(-180).lte(180) });
const bodySchema = z.object({ origin: coordinate, destination: coordinate, vehicle: z.object({ catalogVehicleId: z.string() }), startSocPercent: z.number().min(5).max(100), reserveSocPercent: z.number().min(5).max(40).default(10), objective: z.enum(["fastest", "lowest_cost"]), maxDetourMiles: z.number().min(1).max(50).default(12) });

export async function POST(request: NextRequest) {
  const rate = limitTripRequest(request);
  if (!rate.allowed) return Response.json({ error: "Too many trip requests. Try again shortly.", code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } });
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid trip request", code: "VALIDATION_ERROR", details: parsed.error.flatten() }, { status: 400 });
    const vehicle = vehicleById(parsed.data.vehicle.catalogVehicleId);
    if (!vehicle) return Response.json({ error: "Unknown planning vehicle", code: "VALIDATION_ERROR" }, { status: 400 });
    return Response.json(await createTrip(request, parsed.data.origin, parsed.data.destination, vehicle, parsed.data.startSocPercent, parsed.data.reserveSocPercent, parsed.data.objective, parsed.data.maxDetourMiles));
  } catch (error) {
    const message = error instanceof Error ? error.message : "TRIP_UNAVAILABLE";
    return Response.json({ outcome: "provider_unavailable", error: "Routing is unavailable. Configure the self-hosted Valhalla service and charger catalog.", code: message }, { status: 503 });
  }
}
