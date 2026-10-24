import "server-only";
import type { NextRequest } from "next/server";
import { priceSummary } from "@/lib/catalog/price";
import type { CatalogCharger, CommunityPriceReport } from "@/lib/catalog/types";
import { supabaseForRequest } from "@/lib/supabase/server";
import { planChargingStops, type CorridorCandidate } from "@/lib/trips/planner";
import type { Coordinates, PlanningCharger, PlanningVehicle, TripObjective } from "@/lib/trips/types";
import { roadRoute } from "./providers/valhalla";

const milesPerDegreeLatitude = 69;
const milesPerDegreeLongitude = 58;

function distanceToRouteMiles(point: Coordinates, route: Coordinates[]) {
  if (route.length < 2) return Infinity;
  let closest = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!; const b = route[i]!;
    const px = point.lng * milesPerDegreeLongitude; const py = point.lat * milesPerDegreeLatitude;
    const ax = a.lng * milesPerDegreeLongitude; const ay = a.lat * milesPerDegreeLatitude;
    const bx = b.lng * milesPerDegreeLongitude; const by = b.lat * milesPerDegreeLatitude;
    const dx = bx - ax; const dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    closest = Math.min(closest, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return closest;
}

function mileAlong(point: Coordinates, route: Coordinates[], totalMiles: number) {
  let best = { distance: Infinity, fraction: 0 };
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!; const b = route[i]!;
    const px = point.lng * milesPerDegreeLongitude; const py = point.lat * milesPerDegreeLatitude;
    const ax = a.lng * milesPerDegreeLongitude; const ay = a.lat * milesPerDegreeLatitude;
    const bx = b.lng * milesPerDegreeLongitude; const by = b.lat * milesPerDegreeLatitude;
    const dx = bx - ax; const dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (distance < best.distance) best = { distance, fraction: (i - 1 + t) / (route.length - 1) };
  }
  return best.fraction * totalMiles;
}

async function corridorCandidates(request: NextRequest, route: Coordinates[], routeMiles: number, maxDetourMiles: number): Promise<CorridorCandidate[]> {
  const lats = route.map((point) => point.lat); const lngs = route.map((point) => point.lng);
  const latPadding = maxDetourMiles / milesPerDegreeLatitude; const lngPadding = maxDetourMiles / milesPerDegreeLongitude;
  const supabase = supabaseForRequest(request);
  const { data, error } = await supabase.from("chargers").select("*").gte("latitude", Math.min(...lats) - latPadding).lte("latitude", Math.max(...lats) + latPadding).gte("longitude", Math.min(...lngs) - lngPadding).lte("longitude", Math.max(...lngs) + lngPadding).limit(500);
  if (error) throw error;
  const chargers = (data ?? []) as CatalogCharger[];
  const ids = chargers.map((charger) => charger.id);
  const { data: reports } = ids.length ? await supabase.from("community_price_reports").select("*").in("charger_id", ids).eq("state", "visible") : { data: [] };
  const grouped = new Map<string, CommunityPriceReport[]>();
  for (const report of (reports ?? []) as CommunityPriceReport[]) grouped.set(report.charger_id, [...(grouped.get(report.charger_id) ?? []), report]);
  return chargers.map((charger) => {
    const location = { lat: charger.latitude, lng: charger.longitude };
    const detourMiles = distanceToRouteMiles(location, route);
    const price = priceSummary(grouped.get(charger.id) ?? []).price_per_kwh;
    return { id: charger.id, name: charger.name, location, connectorTypes: charger.connector_types, powerKw: charger.power_kw == null ? null : Number(charger.power_kw), pricePerKwh: price, source: "nrel" as const, sourceUpdatedAt: charger.source_updated_at, availability: charger.operational_status === "E" ? "available" as const : "unknown" as const, publicAccess: true, detourMiles, mileAlong: mileAlong(location, route, routeMiles) };
  }).filter((charger) => charger.detourMiles <= maxDetourMiles);
}

export async function createTrip(request: NextRequest, origin: Coordinates, destination: Coordinates, vehicle: PlanningVehicle, startSocPercent: number, reserveSocPercent: number, objective: TripObjective, maxDetourMiles: number) {
  const road = await roadRoute(origin, destination);
  const candidates = await corridorCandidates(request, road.coordinates, road.miles, maxDetourMiles);
  const directEnergy = road.miles * vehicle.consumptionWhPerMile / 1000 * 1.12;
  const directPossible = vehicle.usableBatteryKwh * startSocPercent / 100 - directEnergy >= vehicle.usableBatteryKwh * reserveSocPercent / 100;
  const result = directPossible ? { stops: [], totalChargeMinutes: 0, estimatedCost: directEnergy * 0.32, warnings: [] } : planChargingStops({ vehicle, startSocPercent, reserveSocPercent, objective, routeMiles: road.miles, candidates });
  const freshness = candidates.map((candidate) => candidate.sourceUpdatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return { outcome: result ? "feasible" as const : "no_feasible_plan" as const, objective, route: road.coordinates, distanceMiles: Math.round(road.miles * 10) / 10, driveMinutes: Math.round(road.minutes), chargeMinutes: result?.totalChargeMinutes, estimatedCost: result?.estimatedCost == null ? result?.estimatedCost : Math.round(result.estimatedCost * 100) / 100, stops: result?.stops ?? [], warnings: result ? [...result.warnings, "Charging availability, prices, weather, traffic, and elevation are not live inputs.", "Candidate detours are corridor estimates; verify station access before departure."] : ["No feasible plan was found within the selected detour and search limits."], assumptions: ["Energy estimates use a curated vehicle baseline plus a 12% planning buffer.", "A charging stop includes the vehicle-specific connection overhead.", "Only public NREL stations with compatible connectors are evaluated."], dataFreshness: freshness };
}
