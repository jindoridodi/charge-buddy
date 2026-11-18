import test from "node:test";
import assert from "node:assert/strict";
import { planLongTrip, routeSearchPoints, searchLongCorridor } from "../src/lib/server/long-trip";
import { NextRequest } from "next/server";
import type { CorridorCandidate } from "../src/lib/trips/planner";
import { VEHICLE_CATALOG } from "../src/lib/trips/vehicles";

const vehicle = { ...VEHICLE_CATALOG[0]!, usableBatteryKwh: 100, consumptionWhPerMile: 1000 / 1.12, connector: "NACS" as const };
const charger = (id: string, mileAlong: number, detourMiles = 0, powerKw = 100): CorridorCandidate => ({ id, name: id, mileAlong, detourMiles, location: { lat: 0, lng: mileAlong / 69 }, connectorTypes: ["TESLA"], powerKw, pricePerKwh: 0.4, source: "nrel", sourceUpdatedAt: null, availability: "unknown", publicAccess: true });

test("route sampling covers long segments and preserves endpoints", () => {
  const points = routeSearchPoints([{ lat: 0, lng: 0 }, { lat: 0, lng: 2 }], 35);
  assert.deepEqual(points[0], { lat: 0, lng: 0 });
  assert.deepEqual(points.at(-1), { lat: 0, lng: 2 });
  assert.equal(points.length, 5);
});

test("long trip avoids a reachable dead end and keeps the reserve", () => {
  const result = planLongTrip({ vehicle, startSocPercent: 70, reserveSocPercent: 10, roadMiles: 200, objective: "fastest", truncated: false, candidates: [charger("safe", 40), charger("dead-end", 45, 15), charger("next", 130)] });
  assert.equal(result?.outcome, "feasible");
  assert.equal(result?.stops[0]?.chargerId, "safe");
  assert.ok(result!.stops.every(stop => stop.arrivalSocPercent >= 10 - 1e-8));
  assert.ok(result!.arrivalSocPercent! >= 10 - 1e-8);
});

test("prefers a faster charger within 20 miles of the furthest viable choice", () => {
  const result = planLongTrip({ vehicle, startSocPercent: 70, reserveSocPercent: 10, roadMiles: 130, objective: "fastest", truncated: false, candidates: [charger("fast", 45, 0, 150), charger("slow", 60, 0, 7), charger("later", 100)] });
  assert.equal(result?.stops[0]?.chargerId, "fast");
});

test("incomplete catalog searches report bounds rather than a false no-plan result", () => {
  const input = { vehicle, startSocPercent: 70, reserveSocPercent: 10, roadMiles: 180, objective: "fastest" as const, candidates: [] };
  assert.equal(planLongTrip({ ...input, truncated: true })?.outcome, "search_bounds_reached");
  assert.equal(planLongTrip({ ...input, truncated: false }), null);
});

test("nearby catalog searches exclude peer locations and keep compatible public stations", async (t) => {
  const beforeUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, beforeKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://catalog-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  t.after(() => { if (beforeUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = beforeUrl; if (beforeKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = beforeKey; });
  const base = { latitude: 0, longitude: 0.5, connector_types: ["TESLA"], power_kw: 150, source_updated_at: null, public_access: true, availability_status: "unknown", community_price_per_kwh: null };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.ok(url.pathname.endsWith("/rpc/search_catalog"));
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.connectors, ["NACS", "TESLA"]);
    return Response.json([{ ...base, id: "nrel", name: "Public", source: "nrel" }, { ...base, id: "peer", name: "Private", source: "peer" }]);
  });
  const result = await searchLongCorridor(new NextRequest("https://app-test.invalid"), [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }], 69, 12, vehicle);
  assert.deepEqual(result.candidates.map(c => c.id), ["nrel"]);
  assert.equal(result.truncated, false);
});
