import test from "node:test";
import assert from "node:assert/strict";
import { loadAccount, saveAccount } from "../src/lib/client/account";

test("account requests reject unsuccessful responses", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "unavailable" }, { status: 503 }));
  await assert.rejects(loadAccount("token"));
  await assert.rejects(saveAccount("token", { revision: 0, favorites: [], vehicles: [], defaultVehicleId: null, settings: { connectors: [], maxDistance: 15, units: "mi", notifyEmail: true, notifyPush: true, notifyBookings: true, defaultMargin: 40, theme: "light" } }));
});
