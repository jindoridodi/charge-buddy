import test from "node:test";
import assert from "node:assert/strict";
import { isCompatible, planChargingStops } from "../src/lib/trips/planner";
import type { CorridorCandidate } from "../src/lib/trips/planner";
import type { PlanningVehicle } from "../src/lib/trips/types";

const vehicle: PlanningVehicle = { id: "test", name: "Test EV", usableBatteryKwh: 60, consumptionWhPerMile: 250, connector: "CCS", maxDcKw: 150, chargeCurve: [{ socPercent: 0, powerKw: 150 }, { socPercent: 80, powerKw: 60 }], stopOverheadMinutes: 5, precision: "curated" };
const charger = (id: string, mileAlong: number, pricePerKwh: number | null, powerKw = 100): CorridorCandidate => ({ id, name: id, location: { lat: 0, lng: 0 }, connectorTypes: ["J1772COMBO"], powerKw, pricePerKwh, source: "nrel", sourceUpdatedAt: null, availability: "available", publicAccess: true, detourMiles: 0, mileAlong });

test("a driver can charge at the origin before an otherwise unreachable trip", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 15, reserveSocPercent: 10, objective: "fastest", routeMiles: 180, candidates: [charger("start", 0, 0.35)] });
  assert.equal(plan?.outcome, "feasible");
  assert.equal(plan?.stops[0]?.chargerId, "start");
});

test("a driver already at the plug can charge even when starting below reserve", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 5, reserveSocPercent: 10, objective: "fastest", routeMiles: 180, candidates: [charger("start", 0, 0.35)] });
  assert.equal(plan?.outcome, "feasible");
  assert.equal(plan?.stops[0]?.chargerId, "start");
});

test("a zero-mile destination cannot claim the reserve is retained below reserve without a charger", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 5, reserveSocPercent: 10, objective: "fastest", routeMiles: 0, candidates: [] });
  assert.equal(plan, null);
  const atPlug = planChargingStops({ vehicle, startSocPercent: 5, reserveSocPercent: 10, objective: "fastest", routeMiles: 0, candidates: [charger("start", 0, 0.35)] });
  assert.equal(atPlug?.stops[0]?.energyAddedKwh, 3);
});

test("a dense compatible corridor reports its candidate bound", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "fastest", routeMiles: 180, candidates: Array.from({ length: 51 }, (_, i) => charger(`station-${i}`, i + 1, 0.35)) });
  assert.equal(plan?.outcome, "search_bounds_reached");
  assert.match(plan?.warnings.join(" ") ?? "", /candidate/);
});

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

test("lowest-cost mode counts only energy purchased at charging stops", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "lowest_cost", routeMiles: 180, candidates: [charger("priced", 90, 0.5)] });
  assert.ok(plan?.estimatedCost != null);
  assert.ok(Math.abs(plan.estimatedCost - 11.7) < 1e-9);
  assert.equal(plan.stops[0]?.estimatedChargeCost, 11.7);
});

test("lowest-cost mode carries cheaper energy forward rather than buying only the next leg", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "lowest_cost", routeMiles: 300, candidates: [charger("cheap", 90, 0.1), charger("expensive", 180, 1)] });
  assert.equal(plan?.outcome, "feasible");
  assert.ok(Math.abs((plan?.estimatedCost ?? Infinity) - 10.02) < 1e-9);
  assert.equal(plan?.stops[0]?.departureSocPercent, 100);
});

test("fastest mode carries energy from a fast charger to avoid slow charging later", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "fastest", routeMiles: 300, candidates: [charger("fast", 90, 0.1, 150), charger("slow", 180, 1, 10)] });
  assert.equal(plan?.outcome, "feasible");
  assert.equal(plan.stops[0]?.chargerId, "fast");
  // A full battery at mile 90 leaves only 4.8 kWh to buy at the 10 kW station.
  assert.equal(plan.stops[0]?.departureSocPercent, 100);
  assert.ok(Math.abs(plan.totalChargeMinutes - 66.88) < 1e-9);
  assert.equal(plan.stops[1]?.energyAddedKwh, 4.8);
});

test("returns null when no candidate can bridge an infeasible leg", () => {
  const plan = planChargingStops({ vehicle, startSocPercent: 30, reserveSocPercent: 10, objective: "fastest", routeMiles: 500, candidates: [charger("too-late", 250, 0.3)] });
  assert.equal(plan, null);
});

test("considers a later corridor charger when early chargers cannot finish the trip", () => {
  const early = Array.from({ length: 30 }, (_, index) => charger(`early-${index}`, index + 1, 0.3));
  // The final 190 miles require 53.2 kWh, leaving the 6 kWh reserve within a 60 kWh battery.
  const plan = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "fastest", routeMiles: 350, candidates: [...early, charger("needed", 160, 0.3)] });

  assert.ok(plan?.stops.some((stop) => stop.chargerId === "needed"));
});

test("a long national corridor honors connector, battery reserve, and detour energy", () => {
  const candidates = [
    { ...charger("incompatible", 80, 0.3), connectorTypes: ["CHADEMO"], location: { lat: 39.55, lng: -105.78 } },
    { ...charger("colorado", 90, 0.3), location: { lat: 39.64, lng: -106.37 }, detourMiles: 5 },
    { ...charger("utah", 180, 0.3), location: { lat: 39.55, lng: -109.55 }, detourMiles: 5 },
  ];
  const plan = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "fastest", routeMiles: 300, candidates });
  assert.equal(plan?.outcome, "feasible");
  assert.deepEqual(plan?.stops.map((stop) => stop.chargerId), ["colorado", "utah"]);
  assert.ok(plan!.stops.every((stop) => stop.arrivalSocPercent >= 10 && stop.departureSocPercent <= 100));
  const tooFar = planChargingStops({ vehicle, startSocPercent: 55, reserveSocPercent: 10, objective: "fastest", routeMiles: 300, candidates: candidates.map((candidate) => ({ ...candidate, detourMiles: 50 })) });
  assert.equal(tooFar, null);
});
