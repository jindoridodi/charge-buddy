import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/trips/route";

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
