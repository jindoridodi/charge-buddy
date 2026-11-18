import "server-only";
import type { NextRequest } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { chargeMinutes, DEFAULT_BUFFER, isCompatible, searchBoundsResult, type CorridorCandidate, type PlanningResult } from "@/lib/trips/planner";
import type { Coordinates, PlanningVehicle, TripObjective, TripStop } from "@/lib/trips/types";
import type { CatalogCharger } from "@/lib/catalog/types";

const SEARCH_INTERVAL_MILES = 35;
const MAX_SEARCHES = 120;
const MAX_PER_SEARCH = 100;
const PARALLEL_SEARCHES = 6;

function distance(a: Coordinates, b: Coordinates) {
  return Math.hypot((a.lat - b.lat) * 69, (a.lng - b.lng) * 69 * Math.cos((a.lat + b.lat) * Math.PI / 360));
}

/** Sample by shape distance, including both endpoints. Each search radius is
 * widened by half an interval so the corridor remains covered between samples. */
export function routeSearchPoints(route: Coordinates[], interval = SEARCH_INTERVAL_MILES): Coordinates[] {
  if (route.length < 2) return route;
  const points = [route[0]!];
  let accumulated = 0;
  let next = interval;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!, b = route[i]!;
    const length = distance(a, b);
    while (length > 0 && accumulated + length >= next) {
      const fraction = (next - accumulated) / length;
      points.push({ lat: a.lat + (b.lat - a.lat) * fraction, lng: a.lng + (b.lng - a.lng) * fraction });
      next += interval;
    }
    accumulated += length;
  }
  points.push(route[route.length - 1]!);
  return points;
}

function project(point: Coordinates, route: Coordinates[], roadMiles: number) {
  let total = 0, closest = Infinity, along = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!, b = route[i]!;
    const scale = 69 * Math.cos((point.lat + a.lat + b.lat) * Math.PI / 540);
    const dx = (b.lng - a.lng) * scale, dy = (b.lat - a.lat) * 69;
    const px = (point.lng - a.lng) * scale, py = (point.lat - a.lat) * 69;
    const length = Math.hypot(dx, dy);
    const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (length * length || 1)));
    const d = Math.hypot(px - t * dx, py - t * dy);
    if (d < closest) { closest = d; along = total + t * length; }
    total += length;
  }
  return { detourMiles: closest, mileAlong: total ? along / total * roadMiles : 0 };
}

export async function searchLongCorridor(request: NextRequest, route: Coordinates[], roadMiles: number, detour: number, vehicle: PlanningVehicle): Promise<{ candidates: CorridorCandidate[]; truncated: boolean }> {
  const points = routeSearchPoints(route);
  if (points.length > MAX_SEARCHES) return { candidates: [], truncated: true };
  const supabase = supabaseForRequest(request);
  const aliases = vehicle.connector === "NACS" ? ["NACS", "TESLA"] : vehicle.connector === "CCS" ? ["CCS", "J1772COMBO"] : vehicle.connector === "CHAdeMO" ? ["CHADEMO", "CHAdeMO"] : [vehicle.connector];
  const stations = new Map<string, CatalogCharger & { community_price_per_kwh: number | string | null }>();
  let truncated = false;
  for (let offset = 0; offset < points.length; offset += PARALLEL_SEARCHES) {
    const pages = await Promise.all(points.slice(offset, offset + PARALLEL_SEARCHES).map(async (point) => {
      const { data, error } = await supabase.rpc("search_catalog", { origin_lat: point.lat, origin_lng: point.lng, radius_miles: detour + SEARCH_INTERVAL_MILES / 2 + 1, connectors: aliases, levels: [], max_price: 1000000, min_power: 0.01, operational: false }).order("id").range(0, MAX_PER_SEARCH);
      if (error) throw error;
      return data ?? [];
    }));
    for (const page of pages) {
      if (page.length > MAX_PER_SEARCH) truncated = true;
      for (const station of page.slice(0, MAX_PER_SEARCH)) stations.set(station.id, station);
    }
  }
  const candidates: CorridorCandidate[] = [];
  for (const station of stations.values()) {
    // Peer coordinates are intentionally approximate and cannot safely be used
    // as road-accessible charging stops.
    if (station.source !== "nrel") continue;
    const location = { lat: station.latitude, lng: station.longitude };
    const charger = { id: station.id, name: station.name, location, connectorTypes: station.connector_types, powerKw: station.power_kw == null ? null : Number(station.power_kw), pricePerKwh: station.community_price_per_kwh == null ? null : Number(station.community_price_per_kwh), source: station.source, sourceUpdatedAt: station.source_updated_at, availability: station.availability_status, publicAccess: station.public_access };
    if (!isCompatible(vehicle, charger)) continue;
    const projection = project(location, route, roadMiles);
    if (projection.detourMiles <= detour) candidates.push({ ...charger, ...projection });
  }
  return { candidates, truncated };
}

/** Backward reachability avoids a greedy stop that leads into a dead end. Full
 * charging provides a conservative feasible plan, not a global optimum. */
export function planLongTrip(input: { candidates: CorridorCandidate[]; vehicle: PlanningVehicle; startSocPercent: number; reserveSocPercent: number; roadMiles: number; objective: TripObjective; truncated: boolean }): PlanningResult | null {
  const { vehicle, roadMiles, reserveSocPercent } = input;
  const nodes = input.candidates.filter(c => input.objective !== "lowest_cost" || c.pricePerKwh != null).sort((a, b) => a.mileAlong - b.mileAlong || a.id.localeCompare(b.id));
  const fullRange = vehicle.usableBatteryKwh * (100 - reserveSocPercent) / 100 / (vehicle.consumptionWhPerMile / 1000 * DEFAULT_BUFFER);
  const startRange = vehicle.usableBatteryKwh * (input.startSocPercent - reserveSocPercent) / 100 / (vehicle.consumptionWhPerMile / 1000 * DEFAULT_BUFFER);
  const reachable = new Array<boolean>(nodes.length).fill(false);
  for (let i = nodes.length - 1; i >= 0; i--) {
    const a = nodes[i]!;
    reachable[i] = roadMiles - a.mileAlong + a.detourMiles <= fullRange;
    for (let j = i + 1; !reachable[i] && j < nodes.length; j++) {
      const b = nodes[j]!;
      if (b.mileAlong - a.mileAlong > fullRange) break;
      if (reachable[j] && b.mileAlong - a.mileAlong + a.detourMiles + b.detourMiles <= fullRange) reachable[i] = true;
    }
  }
  const stops: TripStop[] = [];
  let at = 0, previousDetour = 0, energy = vehicle.usableBatteryKwh * input.startSocPercent / 100;
  let range = startRange, cost: number | null = 0, totalChargeMinutes = 0;
  const consumption = vehicle.consumptionWhPerMile / 1000 * DEFAULT_BUFFER;
  let after = -1;
  while (roadMiles - at + previousDetour > range + 1e-9) {
    let chosen = -1;
    for (let i = after + 1; i < nodes.length; i++) {
      const node = nodes[i]!;
      if (node.mileAlong - at > range) break;
      if (reachable[i] && node.mileAlong - at + previousDetour + node.detourMiles <= range + 1e-9) chosen = i;
    }
    if (chosen < 0) return input.truncated ? searchBoundsResult() : null;
    // Among similarly distant viable stops, prefer higher charging power (or
    // known lower prices for the cost objective), while retaining reachability.
    const furthest = nodes[chosen]!.mileAlong;
    const furthestIndex = chosen;
    for (let i = after + 1; i < furthestIndex; i++) {
      const candidate = nodes[i]!;
      if (candidate.mileAlong < furthest - 20 || !reachable[i] || candidate.mileAlong - at + previousDetour + candidate.detourMiles > range + 1e-9) continue;
      const current = nodes[chosen]!;
      if (input.objective === "fastest" ? Math.min(candidate.powerKw!, vehicle.maxDcKw) > Math.min(current.powerKw!, vehicle.maxDcKw) : candidate.pricePerKwh! < current.pricePerKwh!) chosen = i;
    }
    const node = nodes[chosen]!;
    energy -= (node.mileAlong - at + previousDetour + node.detourMiles) * consumption;
    const arrival = energy / vehicle.usableBatteryKwh * 100;
    const added = vehicle.usableBatteryKwh - energy;
    const minutes = chargeMinutes(vehicle, node.powerKw!, arrival, 100) + vehicle.stopOverheadMinutes;
    const price = node.pricePerKwh == null ? null : added * node.pricePerKwh;
    cost = cost == null || price == null ? null : cost + price;
    totalChargeMinutes += minutes;
    stops.push({ chargerId: node.id, chargerName: node.name, location: node.location, arrivalSocPercent: arrival, departureSocPercent: 100, energyAddedKwh: Math.round(added * 10) / 10, chargeMinutes: Math.round(minutes), pricePerKwh: node.pricePerKwh, estimatedChargeCost: price == null ? null : Math.round(price * 100) / 100, source: node.source });
    energy = vehicle.usableBatteryKwh;
    at = node.mileAlong; previousDetour = node.detourMiles; after = chosen; range = fullRange;
  }
  energy -= (roadMiles - at + previousDetour) * consumption;
  return { outcome: "feasible", stops, totalChargeMinutes, estimatedCost: cost, arrivalSocPercent: energy / vehicle.usableBatteryKwh * 100, warnings: ["Long trips use a bounded reachability search and charge to 100% at each stop; this is a feasible estimate, not an optimized fastest or cheapest trip.", ...(input.truncated ? ["Some areas had more chargers than the search limit; additional choices were not evaluated."] : []), ...(cost == null ? ["One or more stops have unknown pricing."] : [])] };
}
