import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CatalogChargerCard } from "../src/components/CatalogChargerCard";
import type { CatalogCharger } from "../src/lib/catalog/types";
import { AppProvider } from "../src/lib/store";

test("public discovery shows unknown availability separately from operational status", () => {
  const charger = { id: "test", name: "Public charger", address: "Boston", connector_types: ["CCS"], operational_status: "E", availability_status: "unknown" } as CatalogCharger;
  const html = renderToStaticMarkup(createElement(AppProvider, null, createElement(CatalogChargerCard, { charger })));
  assert.match(html, /Availability unknown/);
  assert.match(html, /aria-label="Favorite"[^>]*disabled=""/);
});
