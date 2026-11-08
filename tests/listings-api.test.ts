import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "../src/app/api/listings/route";

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
