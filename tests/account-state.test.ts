import test from "node:test";
import assert from "node:assert/strict";
import { stateForSession } from "../src/lib/store";

test("a new session starts without the prior account's favorites or reservations", () => {
  const state = stateForSession({ id: "user-2", name: "B", email: "b@example.com", phone: "", purpose: "driver" });

  assert.deepEqual(state.favorites, []);
  assert.equal(state.user?.id, "user-2");
  assert.equal(state.reservations.length, 4);
});
