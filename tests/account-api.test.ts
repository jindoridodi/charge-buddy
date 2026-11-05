import test from "node:test";
import assert from "node:assert/strict";
import { GET, PATCH } from "../src/app/api/account/route";

function configure(t: test.TestContext) {
  const config = { NEXT_PUBLIC_SUPABASE_URL: "https://account-test.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-key" };
  const previous = Object.fromEntries(Object.keys(config).map((key) => [key, process.env[key]]));
  Object.assign(process.env, config);
  t.after(() => { for (const key of Object.keys(config)) { if (previous[key] == null) delete process.env[key]; else process.env[key] = previous[key]; } });
}

test("account data is unavailable without a verified session", async (t) => {
  configure(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "Unauthorized" }, { status: 401 }));

  assert.equal((await GET(new Request("https://app-test.invalid/api/account"))).status, 401);
  assert.equal((await PATCH(new Request("https://app-test.invalid/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ favorites: [], vehicles: [], defaultVehicleId: null, settings: { connectors: [], maxDistance: 15, units: "mi", notifyEmail: true, notifyPush: true, notifyBookings: true, defaultMargin: 40, theme: "light" } }) }))).status, 401);
});

test("account writes use the verified session owner, never a posted owner", async (t) => {
  configure(t);
  const writes: unknown[] = [];
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, options?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === "/auth/v1/user") return Response.json({ id: "account-a" });
    paths.push(url.pathname);
    if (options?.method !== "GET") writes.push(JSON.parse(String(options?.body ?? "{}")));
    return Response.json(options?.method === "POST" ? [] : {});
  });

  const response = await PATCH(new Request("https://app-test.invalid/api/account", {
    method: "PATCH",
    headers: { "content-type": "application/json", authorization: "Bearer account-a-token" },
    body: JSON.stringify({
      ownerId: "account-b",
      favorites: ["c1"],
      vehicles: [],
      defaultVehicleId: null,
      settings: { connectors: ["CCS"], maxDistance: 15, units: "mi", notifyEmail: true, notifyPush: false, notifyBookings: true, defaultMargin: 40, theme: "light" },
    }),
  }));

  assert.equal(response.status, 200);
  assert.ok(writes.every((write) => JSON.stringify(write).includes("account-b") === false));
  assert.ok(paths.includes("/rest/v1/rpc/replace_account_data"));
});
