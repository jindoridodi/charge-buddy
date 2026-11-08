import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/trips/route";

test("oversized trip streams stop before providers, regardless of Content-Length", async (t) => {
  const provider = t.mock.method(globalThis, "fetch", async () => { throw new Error("Oversized input reached a provider"); });
  for (const [index, length] of [undefined, "1", "20000"].entries()) {
    let cancelled = false;
    let chunks = 0;
    const body = new ReadableStream({ pull(controller) { if (chunks++ < 4) controller.enqueue(new TextEncoder().encode(" ".repeat(8192))); else controller.close(); }, cancel() { cancelled = true; } });
    const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", headers: { "x-forwarded-for": `192.0.2.${100 + index}`, ...(length ? { "content-length": length } : {}) }, body, duplex: "half" } as RequestInit));
    assert.equal(response.status, 413);
    assert.equal((await response.json()).code, "PAYLOAD_TOO_LARGE");
    assert.equal(cancelled, true);
    assert.equal(provider.mock.callCount(), 0);
  }
});

test("malformed, empty, and structurally invalid trip bodies fail validation without provider calls", async (t) => {
  const provider = t.mock.method(globalThis, "fetch", async () => { throw new Error("Invalid input reached a provider"); });
  const bodies = ["{", "[", "", "   ", "not json", "null", "{}", "[]"];
  for (const [index, body] of bodies.entries()) {
    const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${index + 1}` }, body }));
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal((await response.json()).code, "VALIDATION_ERROR");
    assert.equal(provider.mock.callCount(), 0);
  }
});

test("an unroutable location is distinguished from a routing service outage", async (t) => {
  const previous = process.env.VALHALLA_URL;
  process.env.VALHALLA_URL = "https://routing-test.invalid";
  t.after(() => { if (previous == null) delete process.env.VALHALLA_URL; else process.env.VALHALLA_URL = previous; });
  t.mock.method(globalThis, "fetch", async () => Response.json({ error_code: 171, error: "No suitable edges near location" }, { status: 400 }));
  const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", body: JSON.stringify({ origin: { lat: 37, lng: -122 }, destination: { lat: 38, lng: -122 }, vehicle: { catalogVehicleId: "tesla-model-3-2023-long-range" }, startSocPercent: 70, objective: "fastest" }) }));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).outcome, "invalid_location");
});

test("valid trip requests retain provider failures as 503, including malformed provider JSON", async (t) => {
  const previous = process.env.VALHALLA_URL;
  process.env.VALHALLA_URL = "https://routing-test.invalid";
  t.after(() => { if (previous == null) delete process.env.VALHALLA_URL; else process.env.VALHALLA_URL = previous; });
  let mode = "http";
  const provider = t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    assert.equal(new URL(input instanceof Request ? input.url : String(input)).origin, "https://routing-test.invalid");
    if (mode === "network") throw new Error("Provider connection failed");
    return mode === "json" ? new Response("{", { status: 200, headers: { "content-type": "application/json" } }) : Response.json({ error: "Unavailable" }, { status: 503 });
  });
  for (mode of ["http", "network", "json"]) {
    const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.200" }, body: JSON.stringify({ origin: { lat: 37, lng: -122 }, destination: { lat: 38, lng: -122 }, vehicle: { catalogVehicleId: "tesla-model-3-2023-long-range" }, startSocPercent: 70, objective: "fastest" }) }));
    assert.equal(response.status, 503, mode);
    assert.equal((await response.json()).outcome, "provider_unavailable");
  }
  assert.equal(provider.mock.callCount(), 3);
});

test("invalid routing measurements and shapes return 503 before catalog access", async (t) => {
  const previous = process.env.VALHALLA_URL;
  process.env.VALHALLA_URL = "https://routing-test.invalid";
  t.after(() => { if (previous == null) delete process.env.VALHALLA_URL; else process.env.VALHALLA_URL = previous; });
  let trip: unknown;
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    calls++;
    assert.equal(new URL(input instanceof Request ? input.url : String(input)).origin, "https://routing-test.invalid");
    return Response.json({ trip });
  });
  const invalid = [
    ...[-100, "10", null, 1e309].map((length) => ({ summary: { length, time: 60 }, legs: [{ shape: "????" }] })),
    ...[-1, "60", null, 1e309].map((time) => ({ summary: { length: 10, time }, legs: [{ shape: "????" }] })),
    // The last two polylines encode latitude 91 and longitude 181 degrees.
    ...[123, "???", "~~~~", "!!??", "????????????~", "_keqlD???", "?_sjfxI??"].map((shape) => ({ summary: { length: 10, time: 60 }, legs: [{ shape }] })),
  ];
  for (const [index, value] of invalid.entries()) {
    trip = value;
    const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", headers: { "x-forwarded-for": `198.51.100.${index + 1}` }, body: JSON.stringify({ origin: { lat: 37, lng: -122 }, destination: { lat: 38, lng: -122 }, vehicle: { catalogVehicleId: "tesla-model-3-2023-long-range" }, startSocPercent: 70, objective: "fastest" }) }));
    assert.equal(response.status, 503, JSON.stringify(value));
    assert.equal((await response.json()).code, "ROUTING_INVALID_RESPONSE");
    assert.equal(calls, index + 1);
  }
});

test("national connected routes preserve provider geometry and disconnected regions return no route", async (t) => {
  const previous = process.env.VALHALLA_URL;
  process.env.VALHALLA_URL = "https://routing-test.invalid";
  t.after(() => { if (previous == null) delete process.env.VALHALLA_URL; else process.env.VALHALLA_URL = previous; });
  const routes = [
    { origin: { lat: 61.2181, lng: -149.9003 }, destination: { lat: 64.8378, lng: -147.7164 }, shape: "grmwsBv_e||Ggv|{EwlhdC" },
    { origin: { lat: 21.3069, lng: -157.8583 }, destination: { lat: 21.4022, lng: -157.7394 }, shape: "g`nsg@v~{alHgcyDgfgF" },
    { origin: { lat: 39.7392, lng: -104.9903 }, destination: { lat: 41.8781, lng: -87.6298 }, shape: "_snxjAvdbggEgppaCgfrb`@" },
  ];
  let shape = "";
  t.mock.method(globalThis, "fetch", async () => shape ? Response.json({ trip: { summary: { length: 1, time: 60 }, legs: [{ shape }] } }) : Response.json({ error_code: 442, error: "No route found" }, { status: 400 }));
  for (const [index, route] of routes.entries()) {
    shape = route.shape;
    const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", headers: { "x-forwarded-for": `203.0.113.${index + 1}` }, body: JSON.stringify({ origin: route.origin, destination: route.destination, vehicle: { catalogVehicleId: "tesla-model-3-2023-long-range" }, startSocPercent: 80, objective: "fastest" }) }));
    const trip = await response.json();
    assert.equal(trip.outcome, "feasible");
    assert.deepEqual(trip.route, [route.origin, route.destination]);
  }
  shape = "";
  const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", headers: { "x-forwarded-for": "203.0.113.4" }, body: JSON.stringify({ origin: routes[0]!.origin, destination: routes[1]!.destination, vehicle: { catalogVehicleId: "tesla-model-3-2023-long-range" }, startSocPercent: 80, objective: "fastest" }) }));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).outcome, "invalid_location");
});
