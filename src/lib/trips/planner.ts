import type { PlanningCharger, PlanningVehicle, TripObjective, TripStop } from "./types";

export const DEFAULT_BUFFER = 1.12;
const MAX_SEARCH_ITERATIONS = 3000;

export function normalizeConnector(connector: string) {
  const value = connector.toUpperCase();
  if (value.includes("NACS") || value.includes("TESLA")) return "NACS";
  if (value.includes("CCS") || value.includes("J1772COMBO")) return "CCS";
  if (value.includes("CHADEMO")) return "CHAdeMO";
  return value;
}

export function isCompatible(vehicle: PlanningVehicle, charger: Pick<PlanningCharger, "connectorTypes" | "powerKw" | "publicAccess" | "availability">) {
  return charger.publicAccess && charger.availability !== "unavailable" && charger.powerKw != null && charger.powerKw > 0 && charger.connectorTypes.some((connector) => normalizeConnector(connector) === vehicle.connector);
}

function chargeMinutes(vehicle: PlanningVehicle, chargerKw: number, fromSoc: number, toSoc: number) {
  if (toSoc <= fromSoc) return 0;
  const curve = [...vehicle.chargeCurve].sort((a, b) => a.socPercent - b.socPercent);
  let minutes = 0;
  for (let soc = fromSoc; soc < toSoc;) {
    const next = Math.min(toSoc, (Math.floor(soc / 5) + 1) * 5);
    const point = [...curve].reverse().find((entry) => entry.socPercent <= soc) ?? curve[0]!;
    const power = Math.max(1, Math.min(vehicle.maxDcKw, chargerKw, point.powerKw));
    minutes += ((next - soc) / 100 * vehicle.usableBatteryKwh / power) * 60;
    soc = next;
  }
  return minutes;
}

export interface CorridorCandidate extends PlanningCharger { mileAlong: number; detourMiles: number; }
export interface PlanningInput { vehicle: PlanningVehicle; startSocPercent: number; reserveSocPercent: number; objective: TripObjective; routeMiles: number; candidates: CorridorCandidate[]; }
export interface PlanningResult { outcome: "feasible" | "search_bounds_reached"; stops: TripStop[]; totalChargeMinutes: number; estimatedCost: number | null; warnings: string[]; }

/**
 * A bounded forward search. Candidate stations are projected onto the routed
 * road corridor; edge distance includes an explicit detour penalty. The live
 * provider integration may later replace this with pairwise road matrices.
 */
export function planChargingStops(input: PlanningInput): PlanningResult | null {
  const { vehicle, reserveSocPercent, routeMiles, objective } = input;
  const reserveKwh = vehicle.usableBatteryKwh * reserveSocPercent / 100;
  const initialKwh = vehicle.usableBatteryKwh * input.startSocPercent / 100;
  const nodes = input.candidates.filter((candidate) => isCompatible(vehicle, candidate) && (objective !== "lowest_cost" || candidate.pricePerKwh != null)).sort((a, b) => a.mileAlong - b.mileAlong || a.id.localeCompare(b.id));
  const locations = [{ id: "origin", mileAlong: 0, detourMiles: 0 }, ...nodes, { id: "destination", mileAlong: routeMiles, detourMiles: 0 }];
  type State = { index: number; energyKwh: number; score: number; cost: number | null; chargeMinutes: number; stops: TripStop[]; };
  const bucket = 0.05 * vehicle.usableBatteryKwh;
  const key = (state: State) => `${state.index}:${Math.round(state.energyKwh / bucket)}`;
  const queue: State[] = [{ index: 0, energyKwh: initialKwh, score: 0, cost: 0, chargeMinutes: 0, stops: [] }];
  const best = new Map<string, number>();
  let iterations = 0;

  while (queue.length && iterations++ < MAX_SEARCH_ITERATIONS) {
    queue.sort((a, b) => a.score - b.score);
    const current = queue.shift()!;
    if (current.index === locations.length - 1) return { outcome: "feasible", stops: current.stops, totalChargeMinutes: current.chargeMinutes, estimatedCost: current.cost, warnings: current.stops.some((stop) => stop.pricePerKwh == null) ? ["One or more stops have unknown pricing."] : [] };
    const known = best.get(key(current));
    if (known != null && known <= current.score) continue;
    best.set(key(current), current.score);

    for (let nextIndex = current.index + 1; nextIndex < locations.length; nextIndex++) {
      const next = locations[nextIndex]!;
      const currentNode = locations[current.index]!;
      const baseMiles = next.mileAlong - currentNode.mileAlong;
      if (baseMiles <= 0) continue;
      const legMiles = baseMiles + (currentNode.detourMiles || 0) + (next.detourMiles || 0);
      const legKwh = legMiles * vehicle.consumptionWhPerMile / 1000 * DEFAULT_BUFFER;
      const requiredKwh = legKwh + reserveKwh;
      if (requiredKwh > vehicle.usableBatteryKwh) continue;
      let departureKwh = current.energyKwh;
      let addedKwh = 0;
      let addedMinutes = 0;
      let addedCost = 0;
      let hasUnknownPrice = false;
      if (requiredKwh > departureKwh) {
        if (current.index === 0) continue;
        const charger = nodes[current.index - 1]!;
        addedKwh = requiredKwh - departureKwh;
        const departureSoc = requiredKwh / vehicle.usableBatteryKwh * 100;
        addedMinutes = chargeMinutes(vehicle, charger.powerKw!, departureKwh / vehicle.usableBatteryKwh * 100, departureSoc) + vehicle.stopOverheadMinutes;
        if (charger.pricePerKwh != null) addedCost = addedKwh * charger.pricePerKwh;
        else if (objective === "lowest_cost") continue;
        else hasUnknownPrice = true;
        departureKwh = requiredKwh;
      }
      const arrivalKwh = departureKwh - legKwh;
      const drivingMinutes = legMiles / 55 * 60;
      const nextCost = current.cost == null || hasUnknownPrice ? null : current.cost + addedCost;
      const nextScore = objective === "fastest" ? current.score + drivingMinutes + addedMinutes : (nextCost ?? Number.POSITIVE_INFINITY);
      const stops = [...current.stops];
      if (addedKwh > 0) {
        const charger = nodes[current.index - 1]!;
        stops.push({ chargerId: charger.id, chargerName: charger.name, location: charger.location, arrivalSocPercent: Math.round(current.energyKwh / vehicle.usableBatteryKwh * 100), departureSocPercent: Math.round(departureKwh / vehicle.usableBatteryKwh * 100), energyAddedKwh: Math.round(addedKwh * 10) / 10, chargeMinutes: Math.round(addedMinutes), pricePerKwh: charger.pricePerKwh, estimatedChargeCost: charger.pricePerKwh == null ? null : Math.round(addedCost * 100) / 100, source: charger.source });
      }
      queue.push({ index: nextIndex, energyKwh: arrivalKwh, score: nextScore, cost: nextCost, chargeMinutes: current.chargeMinutes + addedMinutes, stops });
    }
  }
  return queue.length ? { outcome: "search_bounds_reached", stops: [], totalChargeMinutes: 0, estimatedCost: null, warnings: ["The configured search limit was reached before all candidate routes could be evaluated."] } : null;
}
