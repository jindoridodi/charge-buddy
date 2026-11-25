import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createTrip } from "../src/lib/server/trips";
import { VEHICLE_CATALOG } from "../src/lib/trips/vehicles";

function shapeFor(locations: { lat: number; lon: number }[]) {
  let lat = 0, lon = 0, shape = "";
  for (const point of locations) {
    const nextLat = Math.round(point.lat * 1e6), nextLon = Math.round(point.lon * 1e6);
    for (let delta of [nextLat - lat, nextLon - lon]) {
      delta = delta < 0 ? ~(delta << 1) : delta << 1;
      while (delta >= 32) { shape += String.fromCharCode((32 | (delta & 31)) + 63); delta >>>= 5; }
      shape += String.fromCharCode(delta + 63);
    }
    lat = nextLat; lon = nextLon;
  }
  return shape;
}

function configureTrip(t: test.TestContext, failure = false, preceding = 0) {
  const config = { VALHALLA_URL: "https://routing-test.invalid", NEXT_PUBLIC_SUPABASE_URL: "https://catalog-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const key of Object.keys(config)) { if (previous[key] == null) delete process.env[key]; else process.env[key] = previous[key]; } });
  const station = { id: "needed", name: "Midpoint", latitude: 0, longitude: 1, connector_types: ["NACS"], power_kw: 150, source: "nrel", public_access: true, availability_status: "unknown", source_updated_at: null };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === config.VALHALLA_URL) {
      const locations = JSON.parse(String(init?.body)).locations;
      if (locations.length > 2) {
        assert.ok(locations.every((point: { type: string }) => point.type === "break"));
        return Response.json({ trip: { legs: locations.slice(1).map((point: { lat: number; lon: number }, i: number) => ({ shape: shapeFor([locations[i], point]), summary: { length: station.latitude ? 100 : 90, time: station.latitude ? 6540 : 5880 } })) } });
      }
      const direct = locations[0].lon === 0 && locations[1].lon === 2;
      const access = locations[0].lon === 1 && locations[1].lon === 1;
      const miles = direct ? 180 : access ? (station.latitude ? 10 : 0) : station.latitude ? 100 : 90;
      return Response.json({ trip: { summary: { length: miles, time: direct ? 11760 : station.latitude ? 6540 : 5880 }, legs: [{ shape: shapeFor(locations) }] } });
    }
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

test("no-charge trips remain feasible without a configured catalog for either objective", async (t) => {
  const keys = ["VALHALLA_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.VALHALLA_URL = "https://routing-test.invalid";
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  t.after(() => { for (const key of keys) { if (previous[key] == null) delete process.env[key]; else process.env[key] = previous[key]; } });
  const network = t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(new URL(input instanceof Request ? input.url : String(input)).origin, "https://routing-test.invalid", "No-charge trips must not query the catalog");
    return Response.json({ trip: { summary: { length: 1, time: 60 }, legs: [{ shape: shapeFor(JSON.parse(String(init?.body)).locations) }] } });
  });
  for (const objective of ["fastest", "lowest_cost"] as const) {
    const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 37, lng: -122 }, { lat: 37.01, lng: -122 }, VEHICLE_CATALOG[0]!, 80, 10, objective, 12);
    assert.equal(trip.outcome, "feasible");
    assert.equal(trip.objective, objective);
    assert.deepEqual(trip.stops, []);
    assert.equal(trip.distanceMiles, 1);
    assert.equal(trip.driveMinutes, 1);
    assert.equal(trip.chargeMinutes, 0);
    assert.equal(trip.estimatedCost, 0);
    assert.equal(trip.dataFreshness, null);
  }
  assert.equal(network.mock.callCount(), 2);
});

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

test("trip totals include provider road legs through the charging stop", async (t) => {
  const station = configureTrip(t);
  station.latitude = 10 / 69;
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 50, 10, "fastest", 12);
  assert.equal(trip.outcome, "feasible");
  assert.equal(trip.distanceMiles, 200);
  assert.equal(trip.driveMinutes, 218);
  assert.deepEqual(trip.legs.map((leg) => leg.distanceMiles), [100, 100]);
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
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === config.VALHALLA_URL) return Response.json({ trip: { summary: { length: 1, time: 60 }, legs: [{ shape: shapeFor(JSON.parse(String(init?.body)).locations) }] } });
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

test("trip legs retain evaluated battery precision instead of recomputing from rounded stops", async (t) => {
  configureTrip(t);
  const vehicle = VEHICLE_CATALOG[0]!;
  const reserve = 10.4;
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, vehicle, 45, reserve, "fastest", 12);
  assert.equal(trip.outcome, "feasible");
  assert.equal(trip.stops.length, 1);
  assert.ok(Math.abs(trip.legs.at(-1)!.arrivalSocPercent - reserve) < 1e-9);
  const departure = trip.stops[0]!.departureSocPercent;
  assert.ok(Math.abs(departure - Math.round(departure)) > 0.01, "Fixture requires a fractional departure charge");
  assert.equal(trip.legs[1]!.departureSocPercent, departure);
});

test("charger legs use provider road distances and reject an unreachable stop", async (t) => {
  configureTrip(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://routing-test.invalid" && init?.body) {
      const locations = JSON.parse(String(init.body)).locations;
      if (locations.length === 3) return Response.json({ trip: { legs: locations.slice(1).map((point: { lat: number; lon: number }, i: number) => ({ shape: shapeFor([locations[i], point]), summary: { length: i ? 90 : 150, time: 9000 } })) } });
    }
    return original(input, init);
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12);
  assert.equal(trip.outcome, "search_bounds_reached");
  assert.deepEqual(trip.stops, []);
});


test("an inaccessible selected charger does not produce a feasible plan", async (t) => {
  configureTrip(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://routing-test.invalid" && JSON.parse(String(init?.body)).locations[1].lon === 1) {
      return Response.json({ error_code: 442 }, { status: 400 });
    }
    return original(input, init);
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12);
  assert.equal(trip.outcome, "search_bounds_reached");
  assert.deepEqual(trip.stops, []);
});

test("a routing service failure on a selected leg remains an error", async (t) => {
  configureTrip(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://routing-test.invalid" && JSON.parse(String(init?.body)).locations[1].lon === 1) return new Response(null, { status: 503 });
    return original(input, init);
  });
  await assert.rejects(createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12), /ROUTING_503/);
});

test("road detours exceeding the limit do not produce a feasible plan", async (t) => {
  configureTrip(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://routing-test.invalid") {
      const locations = JSON.parse(String(init?.body)).locations;
      if (locations.length === 2 && (locations[0].lon === 1 || locations[1].lon === 1)) return Response.json({ trip: { summary: { length: 110, time: 6600 }, legs: [{ shape: shapeFor(locations) }] } });
    }
    return original(input, init);
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 50, 10, "fastest", 12);
  assert.equal(trip.outcome, "search_bounds_reached");
  assert.deepEqual(trip.stops, []);
});

test("recalculates charging when the road leg needs more energy", async (t) => {
  configureTrip(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://routing-test.invalid") {
      const locations = JSON.parse(String(init?.body)).locations;
      if (locations.length === 3) return Response.json({ trip: { legs: locations.slice(1).map((point: { lat: number; lon: number }, i: number) => ({ shape: shapeFor([locations[i], point]), summary: { length: i ? 100 : 90, time: 6000 } })) } });
    }
    return original(input, init);
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12);
  assert.equal(trip.outcome, "feasible");
  assert.ok(trip.legs.at(-1)!.arrivalSocPercent >= 10 - 1e-9);
  assert.ok(trip.stops[0]!.departureSocPercent > 10);
  assert.match(trip.assumptions.join(" "), /selection.*approximat/i);
});

test("a provider route that snaps a charger to a distant road is not feasible", async (t) => {
  configureTrip(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://routing-test.invalid") {
      const locations = JSON.parse(String(init?.body)).locations;
      if (locations.length === 3) { locations[1].lat = 0.01; return Response.json({ trip: { legs: locations.slice(1).map((point: { lat: number; lon: number }, i: number) => ({ shape: shapeFor([locations[i], point]), summary: { length: 90, time: 5880 } })) } }); }
    }
    return original(input, init);
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12);
  assert.equal(trip.outcome, "search_bounds_reached");
  assert.deepEqual(trip.stops, []);
});

test("even a small gap between road legs is not feasible", async (t) => {
  configureTrip(t);
  const original = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://routing-test.invalid") {
      const locations = JSON.parse(String(init?.body)).locations as { lat: number; lon: number }[];
      if (locations.length !== 3) return original(input, init);
      return Response.json({ trip: { legs: [
        { shape: shapeFor([locations[0]!, { ...locations[1]!, lat: 0.0005 }]), summary: { length: 90, time: 5880 } },
        { shape: shapeFor([{ ...locations[1]!, lat: -0.0005 }, locations[2]!]), summary: { length: 90, time: 5880 } },
      ] } });
    }
    return original(input, init);
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 45, 10, "fastest", 12);
  assert.equal(trip.outcome, "search_bounds_reached");
  assert.deepEqual(trip.stops, []);
});

test("a long trip retries another charger when the first choice exceeds the road detour limit", async (t) => {
  configureTrip(t);
  const stations = [1, 0.9].map((longitude) => ({ id: String(longitude), name: String(longitude), latitude: 0.01, longitude, connector_types: ["NACS"], power_kw: 150, source: "nrel", public_access: true, availability_status: "unknown", source_updated_at: null, community_price_per_kwh: null }));
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://catalog-test.invalid") return Response.json(stations);
    const locations = JSON.parse(String(init?.body)).locations;
    if (locations.length === 3) return Response.json({ trip: { legs: locations.slice(1).map((point: { lat: number; lon: number }, i: number) => ({ shape: shapeFor([locations[i], point]), summary: { length: i ? 160 : 140, time: 6000 } })) } });
    const baseline = locations[0].lon === 0 && locations[1].lon === 2;
    const badAccess = locations[0].lon === 1 && locations[1].lon === 1;
    return Response.json({ trip: { summary: { length: baseline ? 300 : badAccess ? 20 : 1, time: 6000 }, legs: [{ shape: shapeFor(locations) }] } });
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 70, 10, "fastest", 12);
  assert.equal(trip.outcome, "feasible");
  assert.equal(trip.stops[0]?.chargerId, "0.9");
});

test("a retry keeps valid stops shared with a rejected multi-stop plan", async (t) => {
  configureTrip(t);
  const stations = [0.7, 0.8, 1.7].map((longitude) => ({ id: String(longitude), name: String(longitude), latitude: 0.01, longitude, connector_types: ["NACS"], power_kw: 150, source: "nrel", public_access: true, availability_status: "unknown", source_updated_at: null, community_price_per_kwh: null }));
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.origin === "https://catalog-test.invalid") return Response.json(stations);
    const locations = JSON.parse(String(init?.body)).locations;
    if (locations.length > 2) return Response.json({ trip: { legs: locations.slice(1).map((point: { lat: number; lon: number }, i: number) => ({ shape: shapeFor([locations[i], point]), summary: { length: 140, time: 6000 } })) } });
    const baseline = locations[0].lon === 0 && locations[1].lon === 2;
    const badAccess = locations.every((point: { lon: number }) => Math.abs(point.lon - 0.8) < 0.0001);
    return Response.json({ trip: { summary: { length: baseline ? 450 : badAccess ? 20 : 1, time: 6000 }, legs: [{ shape: shapeFor(locations) }] } });
  });
  const trip = await createTrip(new NextRequest("https://app-test.invalid/api/trips"), { lat: 0, lng: 0 }, { lat: 0, lng: 2 }, VEHICLE_CATALOG[0]!, 80, 10, "fastest", 12);
  assert.equal(trip.outcome, "feasible");
  assert.deepEqual(trip.stops.map((stop) => stop.chargerId), ["0.7", "1.7"]);
});
