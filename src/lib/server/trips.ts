import "server-only";
import type { NextRequest } from "next/server";
import type { CatalogCharger } from "@/lib/catalog/types";
import { supabaseForRequest } from "@/lib/supabase/server";
import { isCompatible, planChargingStops, searchBoundsResult, SEARCH_LIMITS, type CorridorCandidate } from "@/lib/trips/planner";
import type { Coordinates, PlanningCharger, PlanningVehicle, TripObjective } from "@/lib/trips/types";
import { roadRoute, ROUTING_TIMEOUT_MS } from "./providers/valhalla";

const milesPerDegreeLatitude = 69;

function milesPerDegreeLongitude(latitude: number) {
  return milesPerDegreeLatitude * Math.cos(latitude * Math.PI / 180);
}

function distanceToRouteMiles(point: Coordinates, route: Coordinates[]) {
  if (route.length < 2) return Infinity;
  let closest = Infinity;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!; const b = route[i]!;
    const longitudeScale = milesPerDegreeLongitude((point.lat + a.lat + b.lat) / 3);
    const px = point.lng * longitudeScale; const py = point.lat * milesPerDegreeLatitude;
    const ax = a.lng * longitudeScale; const ay = a.lat * milesPerDegreeLatitude;
    const bx = b.lng * longitudeScale; const by = b.lat * milesPerDegreeLatitude;
    const dx = bx - ax; const dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    closest = Math.min(closest, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return closest;
}

function mileAlong(point: Coordinates, route: Coordinates[], totalMiles: number) {
  const segments = route.slice(1).map((b, index) => {
    const a = route[index]!;
    return Math.hypot((b.lng - a.lng) * milesPerDegreeLongitude((a.lat + b.lat) / 2), (b.lat - a.lat) * milesPerDegreeLatitude);
  });
  const routeShapeMiles = segments.reduce((sum, distance) => sum + distance, 0);
  if (!routeShapeMiles) return 0;
  let best = { distance: Infinity, miles: 0 };
  let milesBefore = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!; const b = route[i]!;
    const longitudeScale = milesPerDegreeLongitude((point.lat + a.lat + b.lat) / 3);
    const px = point.lng * longitudeScale; const py = point.lat * milesPerDegreeLatitude;
    const ax = a.lng * longitudeScale; const ay = a.lat * milesPerDegreeLatitude;
    const bx = b.lng * longitudeScale; const by = b.lat * milesPerDegreeLatitude;
    const dx = bx - ax; const dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (distance < best.distance) best = { distance, miles: milesBefore + t * segments[i - 1]! };
    milesBefore += segments[i - 1]!;
  }
  return best.miles / routeShapeMiles * totalMiles;
}

async function corridorCandidates(request: NextRequest, route: Coordinates[], routeMiles: number, maxDetourMiles: number, vehicle: PlanningVehicle): Promise<{ candidates: CorridorCandidate[]; truncated: boolean }> {
  const supabase = supabaseForRequest(request);
  const chargers: CatalogCharger[] = [];
  for (let offset = 0; ; ) {
    if (offset >= SEARCH_LIMITS.maxScannedCandidates) return { candidates: [], truncated: true };
    const { data, error } = await supabase.rpc("corridor_chargers", { route_points: route, max_detour_miles: maxDetourMiles }).order("id").range(offset, offset + 99);
    if (error) throw error;
    if (!data?.length) break;
    chargers.push(...(data as CatalogCharger[]).filter((charger) => isCompatible(vehicle, { connectorTypes: charger.connector_types, powerKw: charger.power_kw, publicAccess: charger.public_access, availability: charger.availability_status })));
    if (chargers.length > SEARCH_LIMITS.maxCandidates) return { candidates: [], truncated: true };
    offset += data.length;
  }
  const ids = chargers.map((charger) => charger.id);
  const prices = new Map<string, number | null>();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const { data, error } = await supabase.from("catalog_charger_prices").select("id, community_price_per_kwh").in("id", ids.slice(offset, offset + 50));
    if (error) throw error;
    for (const row of data ?? []) prices.set(row.id, row.community_price_per_kwh == null ? null : Number(row.community_price_per_kwh));
  }
  const candidates = chargers.map((charger) => {
    const location = { lat: charger.latitude, lng: charger.longitude };
    const detourMiles = distanceToRouteMiles(location, route);
    const price = prices.get(charger.id) ?? null;
    return { id: charger.id, name: charger.name, location, connectorTypes: charger.connector_types, powerKw: charger.power_kw == null ? null : Number(charger.power_kw), pricePerKwh: price, source: charger.source, sourceUpdatedAt: charger.source_updated_at, availability: charger.availability_status, publicAccess: charger.public_access, detourMiles, mileAlong: mileAlong(location, route, routeMiles) };
  }).filter((charger) => charger.detourMiles <= maxDetourMiles);
  return { candidates, truncated: false };
}

export async function createTrip(request: NextRequest, origin: Coordinates, destination: Coordinates, vehicle: PlanningVehicle, startSocPercent: number, reserveSocPercent: number, objective: TripObjective, maxDetourMiles: number) {
  const road = await roadRoute(origin, destination);
  const { candidates, truncated } = await corridorCandidates(request, road.coordinates, road.miles, maxDetourMiles, vehicle);
  const directEnergy = road.miles * vehicle.consumptionWhPerMile / 1000 * 1.12;
  const directPossible = vehicle.usableBatteryKwh * startSocPercent / 100 - directEnergy >= vehicle.usableBatteryKwh * reserveSocPercent / 100;
  const result = directPossible ? { outcome: "feasible" as const, stops: [], totalChargeMinutes: 0, estimatedCost: 0, warnings: [] } : truncated ? searchBoundsResult() : planChargingStops({ vehicle, startSocPercent, reserveSocPercent, objective, routeMiles: road.miles, candidates });
  const freshness = candidates.map((candidate) => candidate.sourceUpdatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const detourMiles = result?.stops.reduce((sum, stop) => sum + 2 * (candidates.find((candidate) => candidate.id === stop.chargerId)?.detourMiles ?? 0), 0) ?? 0;
  return { outcome: result?.outcome ?? "no_feasible_plan", objective, route: road.coordinates, distanceMiles: Math.round((road.miles + detourMiles) * 10) / 10, driveMinutes: Math.round(road.minutes + detourMiles / 55 * 60), chargeMinutes: result?.totalChargeMinutes, estimatedCost: result?.estimatedCost == null ? result?.estimatedCost : Math.round(result.estimatedCost * 100) / 100, stops: result?.stops ?? [], warnings: result ? [...result.warnings, "Charging availability, prices, weather, traffic, and elevation are not live inputs.", "Candidate detours are corridor estimates; verify station access before departure."] : ["No feasible plan was found within the selected detour limit."], assumptions: [`At most ${SEARCH_LIMITS.maxScannedCandidates} corridor records and ${SEARCH_LIMITS.maxCandidates} compatible candidates are evaluated; search is limited to ${SEARCH_LIMITS.maxTransitions} transitions and ${SEARCH_LIMITS.maxQueuedStates} queued states.`, "Energy estimates use a curated vehicle baseline plus a 12% planning buffer.", "Costs cover known electricity purchased during this trip, excluding starting charge.", "Detour mileage is estimated from the corridor; additional driving time assumes 55 mph. The map shows the original routed corridor.", "A charging stop includes the vehicle-specific connection overhead.", "Only public NREL stations with compatible connectors are evaluated.", `Search evaluates at most ${SEARCH_LIMITS.maxIterations} states; additional departure charge levels use ${SEARCH_LIMITS.energyStepPercent}% increments.`, `Maximum corridor detour: ${maxDetourMiles} miles. Routing requests time out after ${ROUTING_TIMEOUT_MS / 1000} seconds.`], dataFreshness: freshness };
}
