import test from "node:test";
import assert from "node:assert/strict";
import { isCurrentReport, orderByPrice, priceSummary, selectRankableReport } from "../src/lib/catalog/price";
import { normalizeNrelStation } from "../src/lib/catalog/nrel";
import { filterLocalListings } from "../src/lib/catalog/local-listings";
import { MY_LISTINGS } from "../src/lib/data";

const now = new Date("2026-10-24T12:00:00Z");
const report = (id: string, observed_at: string, state: "visible" | "needs_review" = "visible") => ({ id, charger_id: "a", reporter_id: "u", price_per_kwh: 0.35, observed_at, state, note: null, created_at: "2026-10-01T00:00:00Z" });

test("normalizes a NREL station without parsing operator pricing", () => {
  const result = normalizeNrelStation({ id: 12, station_name: "  Test  ", street_address: "1 Main", latitude: 1, longitude: 2, ev_pricing: "$0.42 / kWh" });
  assert.equal(result?.operator_pricing, "$0.42 / kWh"); assert.equal(result?.name, "Test");
});

test("an operational NREL station has unknown live availability", () => {
  const station = normalizeNrelStation({ id: 1, station_name: "Operational", latitude: 42, longitude: -71, status_code: "E" });
  assert.equal(station?.operational_status, "E");
  assert.equal(station?.availability_status, "unknown");
});
test("current selection excludes stale and reviewed reports", () => {
  assert.equal(isCurrentReport(report("stale", "2026-09-23"), now), false);
  assert.equal(selectRankableReport([report("old", "2026-10-01"), report("new", "2026-10-22"), report("review", "2026-10-23", "needs_review")], now)?.id, "new");
});

test("price freshness uses whole UTC observation dates like the SQL catalog", () => {
  const midday = new Date("2026-10-28T12:00:00Z");
  assert.equal(isCurrentReport(report("boundary", "2026-09-28"), midday), true);
  assert.equal(isCurrentReport(report("expired", "2026-09-27"), midday), false);
  assert.equal(isCurrentReport(report("future", "2026-10-29"), midday), false);
});
test("unknown prices sort after current community prices", () => {
  const sorted = orderByPrice([{ id: "unknown", distance: 1, price_summary: priceSummary([]) }, { id: "known", distance: 10, price_summary: priceSummary([report("a", "2026-10-20")], now) }]);
  assert.deepEqual(sorted.map((x) => x.id), ["known", "unknown"]);
});

test("published local listings remain discoverable and use the selected origin", () => {
  const published = { ...MY_LISTINGS[0]!, id: "published", name: "Boston peer", lat: 42.36, lng: -71.06 };
  const filters = { query: "Boston", origin: { lat: 42.36, lng: -71.06 }, radius: 10, connectors: [], levels: [], maxPrice: 10, minPower: 0, operational: false };
  assert.deepEqual(filterLocalListings([published], filters).map((listing) => listing.id), ["published"]);
  assert.deepEqual(filterLocalListings([published], { ...filters, origin: { lat: 37.33, lng: -121.88 } }), []);
  assert.deepEqual(filterLocalListings([{ ...published, disabled: true }], filters), []);
});
