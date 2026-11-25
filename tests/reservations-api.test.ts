import test from "node:test";
import assert from "node:assert/strict";
import { GET, POST, PATCH } from "../src/app/api/reservations/route";

const listingId = "00000000-0000-0000-0000-000000000201";
const id = "00000000-0000-0000-0000-000000000301";
const valid = () => ({ listingId, startsAt: new Date(Date.now() + 86400_000).toISOString(), endsAt: new Date(Date.now() + 90000_000).toISOString(), requestedKwh: 5 });
const request = (body: unknown, method = "POST") => new Request("https://app.test/api/reservations", { method, headers: { "content-type": "application/json", authorization: "Bearer test-token" }, body: JSON.stringify(body) });
function config(t: test.TestContext) {
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, oldKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://reservation-test.invalid"; process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
  t.after(() => {
    if (oldUrl == null) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey == null) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = oldKey;
  });
}

test("reservation validation rejects invalid dates, slots and forged ownership before network calls", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Invalid input reached network"); });
  for (const body of [null, {}, { ...valid(), requestedKwh: -1 }, { ...valid(), driver_id: "victim" }, { ...valid(), estimated_total: 0 }, { ...valid(), startsAt: "2020-01-01T00:00:00Z" }, { ...valid(), endsAt: new Date(Date.now() + 10 * 86400_000).toISOString() }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal((await PATCH(request({ id, host_id: "victim" }, "PATCH"))).status, 400);
  assert.equal((await POST(request({ ...valid(), padding: "x".repeat(20_000) }))).status, 413);
});

test("reservation requires a verified session", async (t) => {
  config(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "invalid token" }, { status: 401 }));
  assert.equal((await POST(request(valid()))).status, 401);
  assert.equal((await GET(new Request("https://app.test/api/reservations"))).status, 401);
});

test("booking sends only validated slot inputs to the authenticated database function", async (t) => {
  config(t);
  const body = valid();
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "driver" });
    assert.equal(url.pathname, "/rest/v1/rpc/reserve_peer_listing");
    assert.deepEqual(JSON.parse(String(options?.body)), { p_listing_id: listingId, p_starts_at: body.startsAt, p_ends_at: body.endsAt, p_requested_kwh: 5 });
    return Response.json({ id, driver_id: "driver", estimated_total: 2 });
  });
  const response = await POST(request(body));
  assert.equal(response.status, 201);
  assert.equal((await response.json()).reservation.estimated_total, 2);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("overlapping reservations return a retryable slot conflict", async (t) => {
  config(t);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => new URL(input instanceof Request ? input.url : String(input)).pathname === "/auth/v1/user" ? Response.json({ id: "driver" }) : Response.json({ code: "23P01", message: "overlap" }, { status: 409 }));
  const response = await POST(request(valid()));
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /already reserved/);
});

test("cancellation uses session ownership and hides unavailable reservation records", async (t) => {
  config(t);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "stranger" });
    assert.equal(url.pathname, "/rest/v1/rpc/cancel_peer_reservation");
    assert.deepEqual(JSON.parse(String(options?.body)), { p_reservation_id: id });
    return Response.json({ code: "P0002", message: "not found" }, { status: 404 });
  });
  assert.equal((await PATCH(request({ id }, "PATCH"))).status, 404);
});
