import test from "node:test";
import assert from "node:assert/strict";
import { POST as submit } from "../src/app/api/chargers/[id]/price-reports/route";
import { POST as flag } from "../src/app/api/price-reports/[id]/flags/route";
import { PATCH as moderate } from "../src/app/api/price-reports/[id]/route";

const endpoints = [
  { name: "submission", handler: submit, method: "POST", path: "/api/chargers/target/price-reports", body: { pricePerKwh: 0.35, observedAt: "2026-10-31" }, success: 201, denied: 401 },
  { name: "flagging", handler: flag, method: "POST", path: "/api/price-reports/target/flags", body: { reason: "Incorrect price" }, success: 201, denied: 401 },
  { name: "moderation", handler: moderate, method: "PATCH", path: "/api/price-reports/target", body: { state: "removed" }, success: 200, denied: 403 },
];

function configure(t: test.TestContext) {
  const config = { NEXT_PUBLIC_SUPABASE_URL: "https://reports-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const key of Object.keys(config)) { if (previous[key] == null) delete process.env[key]; else process.env[key] = previous[key]; } });
}

async function invoke(endpoint: typeof endpoints[number], body: string) {
  return endpoint.handler(new Request(`https://app-test.invalid${endpoint.path}`, { method: endpoint.method, headers: { "content-type": "application/json", authorization: "Bearer test-token" }, body }), { params: Promise.resolve({ id: "target" }) });
}

async function invalidBodies(t: test.TestContext, endpoint: typeof endpoints[number]) {
  configure(t);
  const network = t.mock.method(globalThis, "fetch", async () => { throw new Error("Invalid input reached Auth or the database"); });
  for (const body of ["{", "[", "", "   ", "not json", "null", "[]", "{}"]) {
    const response = await invoke(endpoint, body);
    assert.equal(response.status, 400, `${endpoint.name}: ${JSON.stringify(body)}`);
    assert.equal((await response.json()).code, "VALIDATION_ERROR");
    assert.equal(network.mock.callCount(), 0);
  }
}

test("price submission rejects invalid JSON and shapes before Auth or database calls", (t) => invalidBodies(t, endpoints[0]!));
test("flagging rejects invalid JSON and shapes before Auth or database calls", (t) => invalidBodies(t, endpoints[1]!));
test("moderation rejects invalid JSON and shapes before Auth or database calls", (t) => invalidBodies(t, endpoints[2]!));

test("a future observation date is a validation failure without Auth or database calls", async (t) => {
  configure(t);
  const network = t.mock.method(globalThis, "fetch", async () => { throw new Error("Future observation reached the network"); });
  const response = await invoke(endpoints[0]!, JSON.stringify({ pricePerKwh: 0.35, observedAt: new Date(Date.now() + 86400000).toISOString().slice(0, 10) }));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "VALIDATION_ERROR");
  assert.equal(network.mock.callCount(), 0);
});

function backend(t: test.TestContext) {
  configure(t);
  const state = { role: "admin" as string | null, result: "success", databaseCalls: 0 };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    assert.equal(url.origin, "https://reports-test.invalid");
    if (url.pathname === "/auth/v1/user") return state.role === null
      ? Response.json({ message: "Unauthorized" }, { status: 401 })
      : Response.json({ id: "actor", app_metadata: { role: state.role }, user_metadata: { role: "admin" } });
    assert.ok(url.pathname.startsWith("/rest/v1/"));
    state.databaseCalls++;
    if (state.result === "network") throw new Error("Database connection failed");
    if (state.result === "json") return new Response("{", { status: 200, headers: { "content-type": "application/json" } });
    if (state.result === "http") return Response.json({ message: "Database unavailable", code: "XX000" }, { status: 503 });
    if (state.result === "duplicate") return Response.json({ message: "Duplicate", code: "23505" }, { status: 409 });
    const body = JSON.parse(String(options?.body));
    if (options?.method === "POST") assert.equal(body.reporter_id, "actor");
    if (url.pathname.endsWith("/price_report_flags")) return Response.json({ id: "saved", ...body });
    return Response.json({ id: "saved", charger_id: "target", reporter_id: body.reporter_id ?? "private-author", price_per_kwh: 0.35, observed_at: "2026-10-31", note: null, state: body.state ?? "visible", created_at: "2026-10-31T00:00:00Z" });
  });
  return state;
}

for (const endpoint of endpoints) {
  test(`${endpoint.name} preserves authorization gates and valid success responses`, async (t) => {
    const state = backend(t);
    for (const role of [null, "ordinary", "admin"]) {
      state.role = role;
      const before = state.databaseCalls;
      const response = await invoke(endpoint, JSON.stringify(endpoint.body));
      const allowed = role !== null && (endpoint.name !== "moderation" || role === "admin");
      assert.equal(response.status, allowed ? endpoint.success : endpoint.denied, String(role));
      assert.equal(state.databaseCalls - before, allowed ? 1 : 0);
      if (allowed && endpoint.name !== "flagging") assert.equal("reporter_id" in (await response.json()).report, false);
    }
  });

  test(`${endpoint.name} preserves genuine database failures and duplicate-conflict responses`, async (t) => {
    const state = backend(t);
    for (const result of ["http", "network", "json"]) {
      state.result = result;
      const response = await invoke(endpoint, JSON.stringify(endpoint.body));
      assert.equal(response.status, 500, result);
      assert.notEqual((await response.json()).code, "VALIDATION_ERROR");
    }
    if (endpoint.name !== "moderation") {
      state.result = "duplicate";
      assert.equal((await invoke(endpoint, JSON.stringify(endpoint.body))).status, 409);
    }
  });
}
