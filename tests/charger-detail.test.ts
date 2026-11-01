import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/chargers/[id]/route";

test("a deactivated imported charger is unavailable through the public detail API", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://catalog-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  t.after(() => {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return url.pathname.endsWith("/chargers") ? Response.json({ id: "inactive", public_access: false, availability_status: "unavailable" }) : Response.json([]);
  });
  const response = await GET(new Request("https://app-test.invalid/api/chargers/inactive"), { params: Promise.resolve({ id: "inactive" }) });
  assert.equal(response.status, 404);
});

test("a catalog outage is a retryable service failure while a missing row remains not found", async (t) => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://catalog-test.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  t.after(() => {
    if (previousUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  let unavailable = true;
  t.mock.method(globalThis, "fetch", async () => unavailable
    ? Response.json({ message: "Catalog is offline" }, { status: 503 })
    : Response.json([]));
  const context = { params: Promise.resolve({ id: "missing" }) };
  const failure = await GET(new Request("https://app-test.invalid/api/chargers/missing"), context);
  assert.equal(failure.status, 503);
  unavailable = false;
  assert.equal((await GET(new Request("https://app-test.invalid/api/chargers/missing"), context)).status, 404);
});
