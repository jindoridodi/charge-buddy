import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/trips/route";

test("an unroutable location is distinguished from a routing service outage", async (t) => {
  const previous = process.env.VALHALLA_URL;
  process.env.VALHALLA_URL = "https://routing-test.invalid";
  t.after(() => { if (previous == null) delete process.env.VALHALLA_URL; else process.env.VALHALLA_URL = previous; });
  t.mock.method(globalThis, "fetch", async () => Response.json({ error_code: 171, error: "No suitable edges near location" }, { status: 400 }));
  const response = await POST(new NextRequest("https://app-test.invalid/api/trips", { method: "POST", body: JSON.stringify({ origin: { lat: 37, lng: -122 }, destination: { lat: 38, lng: -122 }, vehicle: { catalogVehicleId: "tesla-model-3-2023-long-range" }, startSocPercent: 70, objective: "fastest" }) }));
  assert.equal(response.status, 422);
  assert.equal((await response.json()).outcome, "invalid_location");
});
