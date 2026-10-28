import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createTrip } from "../src/lib/server/trips";
import { VEHICLE_CATALOG } from "../src/lib/trips/vehicles";

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
