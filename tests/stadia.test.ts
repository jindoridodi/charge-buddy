import test from "node:test";
import assert from "node:assert/strict";
import { searchPlaces } from "../src/lib/server/providers/nominatim";
import { roadRoute, RoutingLocationError } from "../src/lib/server/providers/valhalla";

test("Stadia geocoding uses server authorization, U.S. filtering and GeoJSON coordinates", async (t) => {
  const previous = process.env.STADIA_MAPS_API_KEY;
  process.env.STADIA_MAPS_API_KEY = "test-secret";
  t.after(() => { if (previous === undefined) delete process.env.STADIA_MAPS_API_KEY; else process.env.STADIA_MAPS_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.href.includes("test-secret"), false);
    assert.equal(url.pathname, "/geocoding/v1/search");
    assert.equal(url.searchParams.get("boundary.country"), "USA");
    assert.equal(url.searchParams.get("text"), "San Jose, CA");
    assert.equal(new Headers(init?.headers).get("authorization"), "Stadia-Auth test-secret");
    return Response.json({ features: [{ geometry: { type: "Point", coordinates: [-121.89, 37.33] }, properties: { gid: "place:1", label: "San Jose, CA" } }] });
  });
  assert.deepEqual(await searchPlaces("San Jose, CA"), [{ id: "place:1", label: "San Jose, CA", location: { lat: 37.33, lng: -121.89 } }]);
});

test("Stadia rejects malformed geocoding responses", async (t) => {
  const previous = process.env.STADIA_MAPS_API_KEY;
  process.env.STADIA_MAPS_API_KEY = "test-secret";
  t.after(() => { if (previous === undefined) delete process.env.STADIA_MAPS_API_KEY; else process.env.STADIA_MAPS_API_KEY = previous; });
  t.mock.method(globalThis, "fetch", async () => Response.json({ features: [{ geometry: { type: "Point", coordinates: [181, 37] }, properties: { gid: "x", label: "x" } }] }));
  await assert.rejects(searchPlaces("place"), /GEOCODING_INVALID_RESPONSE/);
});

test("Stadia routing preserves Valhalla road geometry and reports disconnected routes", async (t) => {
  const previous = process.env.STADIA_MAPS_API_KEY;
  process.env.STADIA_MAPS_API_KEY = "test-secret";
  t.after(() => { if (previous === undefined) delete process.env.STADIA_MAPS_API_KEY; else process.env.STADIA_MAPS_API_KEY = previous; });
  let disconnected = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), "https://api.stadiamaps.com/route/v1");
    assert.equal(new Headers(init?.headers).get("authorization"), "Stadia-Auth test-secret");
    assert.equal(JSON.parse(String(init?.body)).units, "miles");
    return disconnected ? Response.json({ error_code: 442 }, { status: 400 }) : Response.json({ trip: { summary: { length: 10, time: 600 }, legs: [{ shape: "????" }] } });
  });
  const a = { lat: 37, lng: -122 }, b = { lat: 38, lng: -122 };
  assert.deepEqual(await roadRoute(a, b), { coordinates: [{ lat: 0, lng: 0 }, { lat: 0, lng: 0 }], miles: 10, minutes: 10 });
  disconnected = true;
  await assert.rejects(roadRoute(a, b), RoutingLocationError);
});
