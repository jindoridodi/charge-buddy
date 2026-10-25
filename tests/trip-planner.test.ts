import test from "node:test";
import assert from "node:assert/strict";
import { isCompatible, planChargingStops } from "../src/lib/trips/planner";
import type { CorridorCandidate } from "../src/lib/trips/planner";
import type { PlanningVehicle } from "../src/lib/trips/types";

const vehicle: PlanningVehicle = { id: "test", name: "Test EV", usableBatteryKwh: 60, consumptionWhPerMile: 250, connector: "CCS", maxDcKw: 150, chargeCurve: [{ socPercent: 0, powerKw: 150 }, { socPercent: 80, powerKw: 60 }], stopOverheadMinutes: 5, precision: "curated" };
const charger = (id: string, mileAlong: number, pricePerKwh: number | null, powerKw = 100): CorridorCandidate => ({ id, name: id, location: { lat: 0, lng: 0 }, connectorTypes: ["J1772COMBO"], powerKw, pricePerKwh, source: "nrel", sourceUpdatedAt: null, availability: "available", publicAccess: true, detourMiles: 0, mileAlong });

test("normalizes CCS connectors and excludes inaccessible stations", () => {
  assert.equal(isCompatible(vehicle, charger("ccs", 1, 0.3)), true);
  assert.equal(isCompatible(vehicle, { ...charger("closed", 1, 0.3), availability: "unavailable" }), false);
});

test("returns a direct plan when range preserves reserve", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 80, reserveSocPercent: 10, objective: "fastest", routeMiles: 100, candidates: [] });
  assert.ok(plan); assert.equal(plan?.stops.length, 0);
});

test("creates a reachable charge stop and respects the reserve", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "fastest", routeMiles: 180, candidates: [charger("midpoint", 90, 0.35)] });
  assert.ok(plan); assert.equal(plan?.stops[0]?.chargerId, "midpoint"); assert.ok((plan?.stops[0]?.departureSocPercent ?? 0) > (plan?.stops[0]?.arrivalSocPercent ?? 100));
});

test("lowest-cost mode excludes unknown pricing while fastest mode may use it", () => {
  const candidates = [charger("unknown", 80, null, 150), charger("priced", 80, 0.5, 50)];
  const fastest = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "fastest", routeMiles: 180, candidates });
  const cheapest = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "lowest_cost", routeMiles: 180, candidates });
  assert.equal(fastest?.stops[0]?.chargerId, "unknown"); assert.equal(cheapest?.stops[0]?.chargerId, "priced");
});

test("returns null when no candidate can bridge an infeasible leg", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 30, reserveSocPercent: 10, objective: "fastest", routeMiles: 500, candidates: [charger("too-late", 250, 0.3)] });
  assert.equal(plan, null);
});
