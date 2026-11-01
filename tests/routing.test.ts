import test from "node:test";
import assert from "node:assert/strict";
import { roadRoute } from "../src/lib/server/providers/valhalla";

test("routing times out when headers arrive but the body stalls", async (t) => {
  const previous = process.env.VALHALLA_URL;
  process.env.VALHALLA_URL = "https://routing-test.invalid";
  t.after(() => { if (previous == null) delete process.env.VALHALLA_URL; else process.env.VALHALLA_URL = previous; });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let signal: AbortSignal;
  let reading!: () => void;
  const started = new Promise<void>((resolve) => { reading = resolve; });
  t.mock.method(globalThis, "fetch", async (_input: unknown, options: RequestInit) => {
    signal = options.signal!;
    return new Response(new ReadableStream({ start(controller) {
      signal.addEventListener("abort", () => controller.error(new DOMException("Timed out", "AbortError")), { once: true });
      controller.enqueue(new TextEncoder().encode('{"trip":'));
      reading();
    } }));
  });
  const result = roadRoute({ lat: 37, lng: -122 }, { lat: 38, lng: -122 });
  const rejected = assert.rejects(result, { name: "AbortError" });
  await started;
  await Promise.resolve();
  t.mock.timers.tick(12_000);
  assert.equal(signal!.aborted, true);
  await rejected;
});
