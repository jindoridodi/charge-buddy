import test from "node:test";
import assert from "node:assert/strict";
import { toPublicPriceReport } from "../src/lib/catalog/price";

test("public price reports omit the reporter identity", () => {
  const report = toPublicPriceReport({
    id: "report-1",
    charger_id: "charger-1",
    reporter_id: "user-1",
    price_per_kwh: 0.35,
    observed_at: "2026-10-26",
    note: "Evening rate",
    state: "visible",
    created_at: "2026-10-26T12:00:00Z",
  });

  assert.deepEqual(report, {
    id: "report-1",
    charger_id: "charger-1",
    price_per_kwh: 0.35,
    observed_at: "2026-10-26",
    note: "Evening rate",
    state: "visible",
    created_at: "2026-10-26T12:00:00Z",
  });
});
