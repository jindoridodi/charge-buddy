import test from "node:test";
import assert from "node:assert/strict";
import { POST, PATCH } from "../src/app/api/listings/route";

test("invalid peer listing is rejected without writing to the catalog", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Invalid listing reached the network"); });
  const response = await POST(new Request("https://app.test/api/listings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "" }) }));
  assert.equal(response.status, 400);
});

test("unauthenticated account cannot publish a valid peer listing", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://listing-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  t.after(() => {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", () => Promise.resolve(Response.json({ message: "unauthorized" }, { status: 401 })));
  const response = await POST(new Request("https://app.test/api/listings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Charger", address: "123 Secret Street", area: "Boston, MA", connector: "J1772", power_kw: 7.2, price: 0.4, published: true }) }));
  assert.equal(response.status, 401);
});

test("owner can pause without geocoding when the area is unchanged", async (t) => {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, oldGeo = process.env.NOMINATIM_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://listing-test.invalid"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key"; delete process.env.NOMINATIM_URL;
  t.after(() => {
    if (oldUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
    if (oldGeo == null) delete process.env.NOMINATIM_URL; else process.env.NOMINATIM_URL = oldGeo;
  });
  const id = "00000000-0000-0000-0000-000000000101";
  const listing = { id, name: "Charger", address: "123 Secret Street", area: "Boston, MA", connector: "J1772", power_kw: 7.2, price: 0.4, published: false };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "owner" });
    assert.equal(url.pathname, "/rest/v1/peer_listings");
    assert.equal(url.searchParams.get("owner_id"), "eq.owner");
    if (options?.method === "PATCH") {
      const saved = JSON.parse(String(options.body));
      assert.equal(saved.published, false); assert.equal(saved.latitude, 42.361); assert.equal(saved.longitude, -71.057);
      return Response.json({ ...listing, ...saved });
    }
    return Response.json({ area: "Boston, MA", latitude: 42.361, longitude: -71.057 });
  });
  const response = await PATCH(new Request("https://app.test/api/listings", { method: "PATCH", headers: { "content-type": "application/json", authorization: "Bearer token" }, body: JSON.stringify(listing) }));
  assert.equal(response.status, 200);
});


test("host prices are labeled separately from community reports", async () => {
  const { catalogPriceSummary } = await import("../src/lib/catalog/price");
  const summary = catalogPriceSummary({ source: "peer", host_price_per_kwh: 0.4 } as Parameters<typeof catalogPriceSummary>[0]);
  assert.deepEqual(summary, { status: "host", price_per_kwh: 0.4, observed_at: null });
});
