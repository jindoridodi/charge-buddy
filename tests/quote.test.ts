import test from "node:test";
import assert from "node:assert/strict";
import { catalogQuote } from "../src/lib/quote";
import type { CatalogCharger } from "../src/lib/catalog/types";

const station = { latitude: 37, longitude: -122, price_summary: { status: "host", price_per_kwh: 0.25, observed_at: null }, hostFee: 2 } as unknown as CatalogCharger;

test("quote itemization uses the same origin, energy and vehicle efficiency as the total", () => {
  const quote = catalogQuote(station, { lat: 37.1, lng: -122 }, 20, 4);
  assert.equal(quote.electricity, 5);
  assert.equal(quote.hostFee, 2);
  assert.ok(quote.travel > 1);
  assert.equal(quote.total, 5 + 2 + quote.travel);
  assert.equal(catalogQuote(station, null, 20, 4).total, 7);
  assert.equal(catalogQuote(station, { lat: 37, lng: -122 }, 40, 4).total, 12);
  assert.equal(catalogQuote(station, { lat: 37.1, lng: -122 }, 20, 2).travel, quote.travel * 2);
});

test("unknown electricity prices keep the total unknown even with a known travel cost", () => {
  const quote = catalogQuote({ ...station, price_summary: { status: "unknown", price_per_kwh: null, observed_at: null } }, { lat: 37.1, lng: -122 }, 20, 4);
  assert.equal(quote.electricity, null);
  assert.equal(quote.total, null);
  assert.ok(quote.travel > 0);
});
