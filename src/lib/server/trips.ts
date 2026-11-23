import "server-only";
import type { NextRequest } from "next/server";
import type { CatalogCharger } from "@/lib/catalog/types";
import { supabaseForRequest } from "@/lib/supabase/server";
import { chargeMinutes, DEFAULT_BUFFER, isCompatible, planChargingStops, searchBoundsResult, SEARCH_LIMITS, type CorridorCandidate } from "@/lib/trips/planner";
import type { Coordinates, PlanningCharger, PlanningVehicle, TripObjective } from "@/lib/trips/types";
import { roadRoute, RoutingLocationError, ROUTING_TIMEOUT_MS } from "./providers/valhalla";
import { searchLongCorridor, planLongTrip } from "./long-trip";

const milesPerDegreeLatitude = 69;

function milesPerDegreeLongitude(latitude: number) {
  return milesPerDegreeLatitude * Math.cos(latitude * Math.PI / 180);
}

function closestRoutePoint(point: Coordinates, route: Coordinates[]) {
  let closest = Infinity;
  let location = route[0]!;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!; const b = route[i]!;
    const longitudeScale = milesPerDegreeLongitude((point.lat + a.lat + b.lat) / 3);
    const px = point.lng * longitudeScale; const py = point.lat * milesPerDegreeLatitude;
    const ax = a.lng * longitudeScale; const ay = a.lat * milesPerDegreeLatitude;
    const bx = b.lng * longitudeScale; const by = b.lat * milesPerDegreeLatitude;
    const dx = bx - ax; const dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (distance < closest) { closest = distance; location = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) }; }
  }
  return { distance: closest, location };
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
    const detourMiles = closestRoutePoint(location, route).distance;
    const price = prices.get(charger.id) ?? null;
    return { id: charger.id, name: charger.name, location, connectorTypes: charger.connector_types, powerKw: charger.power_kw == null ? null : Number(charger.power_kw), pricePerKwh: price, source: charger.source, sourceUpdatedAt: charger.source_updated_at, availability: charger.availability_status, publicAccess: charger.public_access, detourMiles, mileAlong: mileAlong(location, route, routeMiles) };
  }).filter((charger) => charger.detourMiles <= maxDetourMiles);
  return { candidates, truncated: false };
}

export async function createTrip(request: NextRequest, origin: Coordinates, destination: Coordinates, vehicle: PlanningVehicle, startSocPercent: number, reserveSocPercent: number, objective: TripObjective, maxDetourMiles: number) {
  const road = await roadRoute(origin, destination);
  const directEnergy = road.miles * vehicle.consumptionWhPerMile / 1000 * 1.12;
  const directPossible = vehicle.usableBatteryKwh * startSocPercent / 100 - directEnergy >= vehicle.usableBatteryKwh * reserveSocPercent / 100;
  const longSearch = !directPossible && (road.miles > 250 || road.coordinates.length > 100);
  const { candidates, truncated } = directPossible ? { candidates: [], truncated: false } : longSearch ? await searchLongCorridor(request, road.coordinates, road.miles, maxDetourMiles, vehicle) : await corridorCandidates(request, road.coordinates, road.miles, maxDetourMiles, vehicle);
  let result = directPossible ? { outcome: "feasible" as const, stops: [], totalChargeMinutes: 0, estimatedCost: 0, arrivalSocPercent: (vehicle.usableBatteryKwh * startSocPercent / 100 - directEnergy) / vehicle.usableBatteryKwh * 100, warnings: [] } : longSearch ? planLongTrip({ vehicle, startSocPercent, reserveSocPercent, objective, roadMiles: road.miles, candidates, truncated }) : truncated ? searchBoundsResult() : planChargingStops({ vehicle, startSocPercent, reserveSocPercent, objective, routeMiles: road.miles, candidates });
  // Projected search can discard routes that road routing would make viable.
  if (!result && candidates.length) result = searchBoundsResult();
  const freshness = candidates.map((candidate) => candidate.sourceUpdatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  let route = road.coordinates;
  let distanceMiles = road.miles;
  let driveMinutes = road.minutes;
  let legs: { departureSocPercent: number; arrivalSocPercent: number; distanceMiles: number; driveMinutes: number }[] = [];
  if (result?.outcome === "feasible") {
    const stops = result.stops.map((stop) => ({ ...stop }));
    // Bound provider work even when a long corridor contains many stations.
    if (stops.length > 20) result = searchBoundsResult();
    else {
      const points = [origin, ...stops.map((stop) => stop.location), destination];
      try {
        const routes = stops.length ? await Promise.all(points.slice(1).map((point, i) => roadRoute(points[i]!, point))) : [road];
        // Check road access in both directions to the nearest point on the original corridor.
        const access = await Promise.all(stops.flatMap((stop) => {
          const corridor = closestRoutePoint(stop.location, road.coordinates).location;
          return [roadRoute(corridor, stop.location), roadRoute(stop.location, corridor)];
        }));
        if (access.some((leg) => leg.miles > maxDetourMiles + 1e-9)) result = searchBoundsResult();
        let energy = vehicle.usableBatteryKwh * startSocPercent / 100;
        let cost: number | null = 0;
        let charging = 0;
        for (let i = 0; i < routes.length; i++) {
          const leg = routes[i]!;
          const departureSocPercent = energy / vehicle.usableBatteryKwh * 100;
          energy -= leg.miles * vehicle.consumptionWhPerMile / 1000 * DEFAULT_BUFFER;
          const arrivalSocPercent = energy / vehicle.usableBatteryKwh * 100;
          if (arrivalSocPercent < reserveSocPercent - 1e-9 && !(i === 0 && stops.length && leg.miles === 0)) { result = searchBoundsResult(); break; }
          legs.push({ departureSocPercent, arrivalSocPercent, distanceMiles: Math.round(leg.miles * 10) / 10, driveMinutes: Math.round(leg.minutes) });
          const stop = stops[i];
          if (stop) {
            const required = vehicle.usableBatteryKwh * reserveSocPercent / 100 + routes[i + 1]!.miles * vehicle.consumptionWhPerMile / 1000 * DEFAULT_BUFFER;
            const target = Math.max(energy, required, vehicle.usableBatteryKwh * stop.departureSocPercent / 100);
            if (target > vehicle.usableBatteryKwh + 1e-9) { result = searchBoundsResult(); break; }
            const departureSoc = Math.min(target / vehicle.usableBatteryKwh * 100, 100);
            const candidate = candidates.find((c) => c.id === stop.chargerId)!;
            const added = target - energy;
            const minutes = chargeMinutes(vehicle, candidate.powerKw!, arrivalSocPercent, departureSoc) + (target > energy + 1e-9 ? vehicle.stopOverheadMinutes : 0);
            const price = stop.pricePerKwh == null ? null : added * stop.pricePerKwh;
            Object.assign(stop, { arrivalSocPercent, departureSocPercent: departureSoc, energyAddedKwh: Math.round(added * 10) / 10, chargeMinutes: Math.round(minutes), estimatedChargeCost: price == null ? null : Math.round(price * 100) / 100 });
            cost = cost == null || price == null ? null : cost + price;
            charging += minutes;
            energy = target;
          }
        }
        if (result.outcome === "feasible") {
          result = { ...result, stops, arrivalSocPercent: energy / vehicle.usableBatteryKwh * 100, totalChargeMinutes: charging, estimatedCost: cost };
          route = routes.flatMap((leg, i) => i ? leg.coordinates.slice(1) : leg.coordinates);
          distanceMiles = routes.reduce((sum, leg) => sum + leg.miles, 0);
          driveMinutes = routes.reduce((sum, leg) => sum + leg.minutes, 0);
        }
      } catch (error) {
        if (error instanceof RoutingLocationError) result = searchBoundsResult();
        else throw error;
      }
    }
    if (result.outcome !== "feasible") legs = [];
  }
  return { legs, outcome: result?.outcome ?? "no_feasible_plan", objective, route, distanceMiles: Math.round(distanceMiles * 10) / 10, driveMinutes: Math.round(driveMinutes), chargeMinutes: result?.totalChargeMinutes, estimatedCost: result?.estimatedCost == null ? result?.estimatedCost : Math.round(result.estimatedCost * 100) / 100, stops: result?.stops ?? [], warnings: result ? [...result.warnings, "Charging availability, prices, weather, traffic, and elevation are not live inputs.", "Candidate selection uses corridor estimates; verify station access before departure."] : ["No feasible plan was found within the selected detour limit."], assumptions: [longSearch ? "Long routes search at intervals of about 35 miles, with at most 100 chargers per area and 120 areas." : `At most ${SEARCH_LIMITS.maxScannedCandidates} corridor records and ${SEARCH_LIMITS.maxCandidates} compatible candidates are evaluated; search is limited to ${SEARCH_LIMITS.maxTransitions} transitions and ${SEARCH_LIMITS.maxQueuedStates} queued states.`, "Energy estimates use a curated vehicle baseline plus a 12% planning buffer.", "Costs cover known electricity purchased during this trip, excluding starting charge.", "Selected legs use road routing. Each stop is checked for road access in both directions to its nearest point on the original corridor, within the detour limit. Selection uses approximate corridor estimates, so the chosen plan may not be fastest or cheapest after road routing. At most 20 charging stops are validated.", "A charging stop includes the vehicle-specific connection overhead.", "Only public NREL stations with compatible connectors are evaluated.", longSearch ? "Long-route search favors the furthest reachable charger that can still reach the destination; it charges to 100% at each stop." : `Search evaluates at most ${SEARCH_LIMITS.maxIterations} states; additional departure charge levels use ${SEARCH_LIMITS.energyStepPercent}% increments.`, `Maximum corridor detour: ${maxDetourMiles} miles. Routing requests time out after ${ROUTING_TIMEOUT_MS / 1000} seconds.`], dataFreshness: freshness };
}
