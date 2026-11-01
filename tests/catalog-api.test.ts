import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/chargers/route";

test("CHAdeMO discovery matches the NREL connector spelling", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://catalog-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  t.after(() => {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async (_input: unknown, options: RequestInit) => {
    const connectors = JSON.parse(String(options.body)).connectors;
    return Response.json(connectors.includes("CHADEMO") ? [{ id: "matching-chademo" }] : []);
  });
  const response = await GET(new NextRequest("https://app-test.invalid/api/chargers?connectors=CHAdeMO"));
  assert.equal((await response.json()).chargers[0]?.id, "matching-chademo");
});

test("catalog eligibility reaches the database before pagination", async (t) => {
  const previousUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const previousKey = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  process.env["NEXT_PUBLIC_SUPABASE_URL"] = "https://catalog-test.invalid";
  process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = "test-key";
  t.after(() => {
    if (previousUrl == null) delete process.env["NEXT_PUBLIC_SUPABASE_URL"]; else process.env["NEXT_PUBLIC_SUPABASE_URL"] = previousUrl;
    if (previousKey == null) delete process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]; else process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] = previousKey;
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.pathname, "/rest/v1/rpc/search_catalog");
    const filters = JSON.parse(String(options?.body));
    assert.equal(filters.origin_lat, 42.36);
    assert.equal(filters.origin_lng, -71.06);
    assert.equal(filters.radius_miles, 10);
    assert.deepEqual(filters.connectors, ["CCS", "J1772COMBO"]);
    assert.equal(filters.min_power, 50);
    assert.equal(url.searchParams.get("offset"), "100");
    return Response.json([{ id: "matching", community_price_per_kwh: null }], { headers: { "content-range": "100-100/101" } });
  });
  const response = await GET(new NextRequest("https://app-test.invalid/api/chargers?lat=42.36&lng=-71.06&radius=10&connectors=CCS&minPower=50&page=2&limit=100"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.total, 101);
  assert.equal(body.chargers[0].id, "matching");
});

test("invalid catalog filters are rejected before any database request", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Invalid filters reached the network"); });
  for (const query of ["lat=42", "lat=NaN&lng=0", "radius=-1", "connectors=invalid", "levels=invalid"]) {
    const response = await GET(new NextRequest(`https://app-test.invalid/api/chargers?${query}`));
    assert.equal(response.status, 400, query);
  }
});

test("unknown prices remain discoverable but are excluded before ranked pagination", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://catalog-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  t.after(() => {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const rows = [{ id: "known", community_price_per_kwh: 0.3, community_price_observed_at: "2026-10-31" }, { id: "unknown", community_price_per_kwh: null }];
    const eligible = url.searchParams.get("community_price_per_kwh") === "not.is.null" ? rows.slice(0, 1) : rows;
    return Response.json(eligible.slice(Number(url.searchParams.get("offset") ?? 0)), { headers: { "content-range": `*/${eligible.length}` } });
  });
  const ordinary = await GET(new NextRequest("https://app-test.invalid/api/chargers"));
  assert.equal((await ordinary.json()).chargers.length, 2);
  const ranked = await GET(new NextRequest("https://app-test.invalid/api/chargers?sort=price&page=2&limit=1"));
  const body = await ranked.json();
  assert.deepEqual(body.chargers, []);
  assert.equal(body.total, 1);
});
