import { VEHICLE_CATALOG } from "@/lib/trips/vehicles";

export const dynamic = "force-dynamic";

export function GET() { return Response.json({ vehicles: VEHICLE_CATALOG }); }
