import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createTrip } from "../src/lib/server/trips";
import { VEHICLE_CATALOG } from "../src/lib/trips/vehicles";

function configureTrip(t: test.TestContext, failure = false, preceding = 0) {
  const config = { VALHALLA_URL: "https://routing-test.invalid", NEXT_PUBLIC_SUPABASE_URL: "https://catalog-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const key of Object.keys(config)) { if (previous[key] == null) delete process.env[key]; else process.env[key] = previous[key]; } });
  const station = { id: "needed", name: "Midpoint", latitude: 0, longitude: 1, connector_types: ["NACS"], power_kw: 150, source: "nrel", public_access: true, availability_status: "unknown", source_updated_at: null };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === config.VALHALLA_URL) return Response.json({ trip: { summary: { length: 180, time: 11760 }, legs: [{ shape: "???_gayB" }] } });
    assert.equal(url.origin, config.NEXT_PUBLIC_SUPABASE_URL);
    assert.ok(url.href.length < 4000, "Price lookups must fit ordinary HTTP request limits");
    if (url.pathname.endsWith("corridor_chargers")) {
      const rows = [...Array.from({ length: preceding }, (_, i) => ({ ...station, id: `incompatible-${i}`, connector_types: ["J1772"] })), station];
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);
      return Response.json(rows.slice(offset, offset + limit));
    }
    if (failure) return Response.json({ message: "price service unavailable" }, { status: 503 });
    return Response.json(url.searchParams.get("id")?.includes("needed") ? [{ id: "needed", community_price_per_kwh: 0.35 }] : []);
  });
  return station;
}

test("a failed price read is a service failure, not an infeasible trip", async (t) => {
  configureTrip(t, true);
  await assert.rejects(createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "lowest_cost", 12));
});

test("a compatible corridor charger beyond the first database page remains reachable", async (t) => {
  configureTrip(t, false, 1000);
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12);
  assert.equal(trip.outcome, "feasible");
  assert.equal(trip.stops[0]?.chargerId, "needed");
});

test("trip totals include the evaluated charging detour", async (t) => {
  const station = configureTrip(t);
  station.latitude = 10 / 69;
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 50, 10, "fastest", 12);
  assert.equal(trip.outcome, "feasible");
  assert.equal(trip.distanceMiles, 200);
  assert.equal(trip.driveMinutes, 218);
});

test("a corridor beyond the disclosed scan limit is bounded rather than falsely infeasible", async (t) => {
  configureTrip(t, false, 10_000);
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12);
  assert.equal(trip.outcome, "search_bounds_reached");
  assert.match(trip.assumptions.join(" "), /10,?000 corridor/);
});

test("successful trip results disclose the bounds actually applied", async (t) => {
  const config = { VALHALLA_URL: "https://routing-test.invalid", NEXT_PUBLIC_SUPABASE_URL: "https://catalog-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const key of Object.keys(config)) { if (previous[key] == null) delete process.env[key]; else process.env[key] = previous[key]; } });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === config.VALHALLA_URL) return Response.json({ trip: { summary: { length: 1, time: 60 }, legs: [{ shape: "????" }] } });
    assert.equal(url.origin, config.NEXT_PUBLIC_SUPABASE_URL);
    return Response.json([]);
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 37, lng: -122 }, { lat: 37.01, lng: -122 }, VEHICLE_CATALOG[0]!, 80, 10, "lowest_cost", 12);
  assert.equal(trip.outcome, "feasible");
  const assumptions = trip.assumptions.join(" ");
  assert.match(assumptions, /3,?000/);
  assert.match(assumptions, /5%/);
  assert.match(assumptions, /12 miles/);
  assert.match(assumptions, /12 seconds/);
});
