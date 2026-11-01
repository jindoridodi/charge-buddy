import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../src/app/api/chargers/[id]/route";

function configure(t: test.TestContext) {
  const config = { NEXT_PUBLIC_SUPABASE_URL: "https://catalog-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const key of Object.keys(config)) { if (previous[key] == null) delete process.env[key]; else process.env[key] = previous[key]; } });
}

test("a deactivated imported charger is unavailable through the public detail API", async (t) => {
  configure(t);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return url.pathname.endsWith("/catalog_charger_prices") ? Response.json({ id: "inactive", public_access: false, availability_status: "unavailable" }) : Response.json([]);
  });
  const response = await GET(new Request("https://app-test.invalid/api/chargers/inactive"), { params: Promise.resolve({ id: "inactive" }) });
  assert.equal(response.status, 404);
});

test("a catalog outage is a retryable service failure while a missing row remains not found", async (t) => {
  configure(t);
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

test("detail uses the authoritative price even when 1,000 newer reviewed reports fill history", async (t) => {
  configure(t);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const visible = { id: "visible", charger_id: "busy", reporter_id: "private-author", price_per_kwh: 0.35, observed_at: yesterday, created_at: `${yesterday}T00:00:00Z`, state: "visible", note: "Current visible price" };
  const history = [...Array.from({ length: 1000 }, (_, index) => ({ ...visible, id: `review-${index}`, price_per_kwh: 0.90, observed_at: today, created_at: `${today}T00:00:00Z`, state: "needs_review" })), visible];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://catalog-test.invalid");
    if (url.pathname.endsWith("/community_price_reports")) {
      assert.ok(!url.searchParams.get("select")?.includes("reporter_id"));
      assert.equal(url.searchParams.get("state"), "in.(visible,needs_review)");
      return Response.json(history.slice(0, 1000));
    }
    const charger = { id: "busy", public_access: true };
    return Response.json(url.pathname.endsWith("/catalog_charger_prices")
      ? { ...charger, community_price_per_kwh: 0.35, community_price_observed_at: yesterday }
      : charger);
  });
  const response = await GET(new Request("https://app-test.invalid/api/chargers/busy"), { params: Promise.resolve({ id: "busy" }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.charger.price_summary, { status: "community", price_per_kwh: 0.35, observed_at: yesterday });
  assert.equal(body.reports.length, 1000);
  assert.ok(body.reports.every((report: { state: string }) => report.state === "needs_review"));
  assert.equal(JSON.stringify(body).includes("private-author"), false);
  assert.equal(JSON.stringify(body).includes("reporter_id"), false);
});

test("unknown authoritative prices retain public visible and reviewed history without reporter identities", async (t) => {
  configure(t);
  const oldDate = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.endsWith("/catalog_charger_prices")) return Response.json({ id: "unknown", public_access: true, community_price_per_kwh: null, community_price_observed_at: null });
    assert.equal(url.pathname, "/rest/v1/community_price_reports");
    assert.equal(url.searchParams.get("state"), "in.(visible,needs_review)");
    assert.ok(!url.searchParams.get("select")?.includes("reporter_id"));
    return Response.json(["visible", "needs_review"].map((state) => ({ id: state, charger_id: "unknown", reporter_id: "private", price_per_kwh: 0.35, observed_at: oldDate, created_at: `${oldDate}T00:00:00Z`, state, note: "Public note" })));
  });
  const response = await GET(new Request("https://app-test.invalid/api/chargers/unknown"), { params: Promise.resolve({ id: "unknown" }) });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.charger.price_summary, { status: "unknown", price_per_kwh: null, observed_at: null });
  assert.deepEqual(body.reports.map((report: { state: string; note: string }) => [report.state, report.note]), [["visible", "Public note"], ["needs_review", "Public note"]]);
  assert.equal(JSON.stringify(body).includes("reporter_id"), false);
});

test("price-view and report-history backend failures remain retryable 503 responses", async (t) => {
  configure(t);
  let target = "", mode = "";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://catalog-test.invalid");
    if (url.pathname.endsWith(`/${target}`)) {
      if (mode === "network") throw new Error("Private backend failure");
      if (mode === "json") return new Response("{", { headers: { "content-type": "application/json" } });
      return Response.json({ message: "Private backend failure" }, { status: 503 });
    }
    return Response.json({ id: "station", public_access: true, community_price_per_kwh: 0.35, community_price_observed_at: new Date().toISOString().slice(0, 10) });
  });
  for (target of ["catalog_charger_prices", "community_price_reports"]) {
    for (mode of ["http", "network", "json"]) {
      const response = await GET(new Request("https://app-test.invalid/api/chargers/station"), { params: Promise.resolve({ id: "station" }) });
      assert.equal(response.status, 503, `${target}: ${mode}`);
      assert.deepEqual(await response.json(), { error: "Charger service is unavailable. Try again." });
    }
  }
});
