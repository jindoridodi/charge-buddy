import test from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../src/lib/server/rate-limit";

test("rejects a request after its per-client limit", () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => 0 });

  assert.equal(limiter.check("client").allowed, true);
  assert.equal(limiter.check("client").allowed, true);
  assert.equal(limiter.check("client").allowed, false);
});
