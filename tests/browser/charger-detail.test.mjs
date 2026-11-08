import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

let server, browser, origin;
const trip = { outcome: "feasible", objective: "fastest", route: [{ lat: 37, lng: -122 }, { lat: 38, lng: -122 }], distanceMiles: 80, driveMinutes: 90, chargeMinutes: 0, estimatedCost: 23, stops: [], warnings: [], assumptions: ["Synthetic evaluated assumptions"], dataFreshness: null };

async function tripPage(t, overrides = {}) {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/vehicles/catalog") return route.fulfill({ json: { vehicles: [{ id: "first", name: "First EV", connector: "CCS", precision: "curated" }, { id: "second", name: "Second EV", connector: "CCS", precision: "curated" }] } });
    if (url.pathname === "/api/locations") return overrides.location ? overrides.location(route) : route.fulfill({ json: { places: [{ id: "place", label: url.searchParams.get("q"), location: { lat: 37, lng: -122 } }] } });
    if (url.pathname === "/api/trips") return overrides.plan ? overrides.plan(route) : route.fulfill({ json: { ...trip, objective: route.request().postDataJSON().objective } });
    return route.continue();
  });
  await page.goto(`${origin}/route-planner`);
  await page.getByRole("button", { name: "Plan route", exact: true }).waitFor();
  await page.getByLabel("Planning vehicle").selectOption("first");
  return page;
}
const id = "00000000-0000-0000-0000-000000000055";
const charger = { id, name: "Public test station", address: "Boston", connector_types: ["CCS"], operational_status: "E", availability_status: "unknown", imported_at: "2026-11-01T00:00:00Z", price_summary: { status: "unknown", price_per_kwh: null, observed_at: null } };

test("anonymous discovery and detail do not fall back to sample chargers", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/chargers") return route.fulfill({ json: { chargers: [], total: 0 } });
    if (url.pathname === "/api/chargers/c1") return route.fulfill({ status: 404, json: { error: "Charger not found" } });
    return route.continue();
  });
  await page.goto(`${origin}/chargers`);
  await page.getByText("No public chargers match these filters.", { exact: true }).waitFor();
  assert.equal(await page.getByText("My Garage Charger", { exact: true }).count(), 0);
  await page.goto(`${origin}/chargers/c1`);
  await page.getByText("Charger not found.", { exact: true }).waitFor();
});

before(async () => {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "0"], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  origin = await new Promise((resolve, reject) => {
    let output = "";
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 30000);
    const inspect = (chunk) => {
      output += chunk.toString();
      const url = output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (url && output.includes("Ready")) { clearTimeout(timeout); resolve(url); }
    };
    server.stdout.on("data", inspect);
    server.stderr.on("data", inspect);
    server.once("error", (error) => { clearTimeout(timeout); reject(error); });
    server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${output}`)); });
  });
  browser = await chromium.launch({ channel: "chrome", headless: true });
});

after(async () => {
  try { await browser?.close(); }
  finally {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit");
      server.kill("SIGTERM");
      await exited;
    }
  }
});

test("public detail distinguishes loading, outages, retry, and missing chargers", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  let attempts = 0, release;
  const held = new Promise((resolve) => { release = resolve; });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === `/api/chargers/${id}`) {
      if (++attempts === 1) { await held; return route.fulfill({ status: 503, json: { error: "Charger service is unavailable. Try again." } }); }
      return route.fulfill({ json: { charger, reports: [] } });
    }
    if (url.pathname.startsWith("/api/chargers/")) return route.fulfill({ status: 404, json: { error: "Charger not found" } });
    return route.continue();
  });
  await page.goto(`${origin}/chargers/${id}`);
  try { await page.getByRole("status").filter({ hasText: "Loading charger" }).waitFor(); }
  finally { release(); }
  await page.getByRole("alert").filter({ hasText: "unavailable" }).waitFor();
  assert.equal(await page.getByText("Charger not found.", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "Retry loading charger", exact: true }).click();
  await page.getByRole("heading", { name: charger.name, exact: true }).waitFor();
  await page.goto(`${origin}/chargers/00000000-0000-0000-0000-000000000056`);
  await page.getByText("Charger not found.", { exact: true }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Retry loading charger", exact: true }).count(), 0);
});

test("submitting a report refreshes the displayed authoritative price", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  const reports = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === `/api/chargers/${id}/price-reports`) {
      const body = route.request().postDataJSON();
      const report = { id: `report-${reports.length}`, charger_id: id, price_per_kwh: body.pricePerKwh, observed_at: body.observedAt, state: "visible", note: null, created_at: new Date().toISOString() };
      reports.push(report);
      return route.fulfill({ status: 201, json: { report } });
    }
    if (url.pathname === `/api/chargers/${id}`) return route.fulfill({ json: { charger: { ...charger, price_summary: reports.length ? { status: "community", price_per_kwh: 0.35, observed_at: reports[0].observed_at } : charger.price_summary }, reports } });
    return route.continue();
  });
  await page.goto(`${origin}/chargers/${id}`);
  const priceCard = page.getByText("Price", { exact: true }).locator("..");
  await priceCard.getByText("Price unknown", { exact: true }).waitFor();
  await page.getByLabel("Price (USD/kWh)").fill("0.35");
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await priceCard.getByText("$0.35/kWh", { exact: true }).waitFor();
  assert.equal(reports.length, 1);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page.getByLabel("Price (USD/kWh)").fill("0.50");
  await page.getByLabel("Observed date").fill(yesterday);
  await page.getByRole("button", { name: "Submit report", exact: true }).click();
  await page.getByText(`$0.50/kWh · ${yesterday}`, { exact: true }).waitFor();
  await priceCard.getByText("$0.35/kWh", { exact: true }).waitFor();
  assert.equal(reports.length, 2);
});

test("public discovery includes a charger after its price becomes more than fifty cents", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  let price = null;
  const caps = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/api/chargers") {
      const cap = Number(url.searchParams.get("maxPrice") ?? 10);
      caps.push(cap);
      const visible = price == null || price <= cap;
      return route.fulfill({ json: { chargers: visible ? [{ ...charger, latitude: 42.36, longitude: -71.06, connector_types: [], price_summary: { ...charger.price_summary, price_per_kwh: price } }] : [], total: visible ? 1 : 0 } });
    }
    return route.continue();
  });
  await page.goto(`${origin}/chargers`);
  await page.getByText(charger.name, { exact: true }).waitFor();
  price = 0.60;
  await page.reload();
  await page.getByText(charger.name, { exact: true }).waitFor();
  await page.getByText("$0.60/kWh", { exact: true }).waitFor();
  assert.ok(caps.length >= 2);
  assert.ok(caps.every((cap) => cap >= 9.99));
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  const priceSlider = page.getByRole("slider").nth(1);
  await priceSlider.focus();
  await page.keyboard.press("Home");
  await page.getByText("No public chargers match these filters.", { exact: true }).waitFor();
  await priceSlider.focus();
  await page.keyboard.press("End");
  await page.getByText(charger.name, { exact: true }).waitFor();
});

test("public discovery lets a charger be saved as a favorite", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  page.setDefaultTimeout(3000);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === `/api/chargers/${id}`) return route.fulfill({ json: { charger: { ...charger, latitude: 42.36, longitude: -71.06 }, reports: [] } });
    if (url.pathname === "/api/chargers") return route.fulfill({ json: { chargers: [{ ...charger, latitude: 42.36, longitude: -71.06 }], total: 1 } });
    return route.continue();
  });
  await page.goto(`${origin}/chargers`);
  const favorite = page.locator(`#card-${id}`).getByRole("button", { name: "Favorite", exact: true });
  await favorite.waitFor();
  assert.equal(await favorite.getAttribute("aria-pressed"), "false");
  await favorite.click();
  assert.equal(await favorite.getAttribute("aria-pressed"), "true");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await page.getByRole("tab", { name: "Favorites", exact: true }).click();
  await page.getByText(charger.name, { exact: true }).waitFor();
});

test("changing any planning input invalidates the completed trip", async (t) => {
  const page = await tripPage(t);
  const changes = [
    () => page.getByLabel("Route objective").selectOption("lowest_cost"),
    () => page.getByLabel("Starting point").fill("Boston, MA"),
    () => page.getByLabel("Destination").fill("Portland, ME"),
    () => page.getByLabel("Planning vehicle").selectOption("second"),
    () => page.getByLabel("Current charge").fill("50"),
    () => page.getByLabel("Battery reserve").fill("15"),
    () => page.getByLabel("Maximum charger detour").fill("20"),
  ];
  for (const change of changes) {
    await page.getByRole("button", { name: "Plan route", exact: true }).click();
    await page.getByText("Synthetic evaluated assumptions", { exact: true }).waitFor();
    await change();
    await page.getByText("Synthetic evaluated assumptions", { exact: true }).waitFor({ state: "hidden" });
    assert.equal(await page.getByRole("heading", { name: "Charging plan", exact: true }).count(), 0);
    assert.equal(await page.getByText("$23.00 en route", { exact: true }).count(), 0);
  }
});

test("completed trip labels use the evaluated response objective", async (t) => {
  const page = await tripPage(t, { plan: (route) => route.fulfill({ json: { ...trip, objective: "lowest_cost" } }) });
  await page.getByRole("button", { name: "Plan route", exact: true }).click();
  await page.getByText("Lowest estimated-cost route", { exact: true }).waitFor();
  assert.equal(await page.getByText("Fastest feasible estimate", { exact: true }).count(), 0);
});

test("editing while a trip is pending permits replanning and ignores the older response", async (t) => {
  let release, started;
  const held = new Promise((resolve) => { release = resolve; });
  const pending = new Promise((resolve) => { started = resolve; });
  let attempts = 0;
  const page = await tripPage(t, { plan: async (route) => {
    if (++attempts === 1) {
      started();
      await held;
      return route.fulfill({ json: { ...trip, assumptions: ["Obsolete trip assumptions"] } }).catch(() => {});
    }
    return route.fulfill({ json: { ...trip, objective: "lowest_cost", estimatedCost: 12 } });
  } });
  try {
    await page.getByRole("button", { name: "Plan route", exact: true }).click();
    await pending;
    const cancelled = page.waitForEvent("requestfailed", (request) => new URL(request.url()).pathname === "/api/trips");
    await page.getByLabel("Route objective").selectOption("lowest_cost");
    await cancelled;
    await page.getByRole("button", { name: "Plan route", exact: true }).click();
    await page.getByText("$12.00 en route", { exact: true }).waitFor();
    release();
    // A subsequent completed plan also proves the late response cannot keep the UI busy.
    await page.getByRole("button", { name: "Plan route", exact: true }).click();
    await page.getByText("$12.00 en route", { exact: true }).waitFor();
    assert.equal(await page.getByText("Obsolete trip assumptions", { exact: true }).count(), 0);
    assert.equal(await page.getByText("$23.00 en route", { exact: true }).count(), 0);
  } finally { release(); }
});

test("editing cancels pending geocoding and clears errors before the next plan", async (t) => {
  let release, started;
  const held = new Promise((resolve) => { release = resolve; });
  const pending = new Promise((resolve) => { started = resolve; });
  let locations = 0, plans = 0;
  const page = await tripPage(t, {
    location: async (route) => {
      if (++locations === 1) {
        started();
        await held;
        return route.fulfill({ status: 503, json: { error: "Obsolete location failure" } }).catch(() => {});
      }
      return route.fulfill({ json: { places: [{ id: "new", label: "New endpoint", location: { lat: 38, lng: -122 } }] } });
    },
    plan: (route) => ++plans === 1 ? route.fulfill({ json: trip }) : route.fulfill({ status: 503, json: { error: "Current provider failure" } }),
  });
  try {
    await page.getByRole("button", { name: "Plan route", exact: true }).click();
    await pending;
    const cancelled = page.waitForEvent("requestfailed", (request) => new URL(request.url()).pathname === "/api/locations");
    await page.getByLabel("Starting point").fill("Boston, MA");
    await cancelled;
    await page.getByRole("button", { name: "Plan route", exact: true }).click();
    await page.getByText("Synthetic evaluated assumptions", { exact: true }).waitFor();
    release();
    assert.equal(plans, 1);
    assert.equal(await page.getByText("Obsolete location failure", { exact: true }).count(), 0);
    await page.getByRole("button", { name: "Plan route", exact: true }).click();
    await page.getByText("Current provider failure", { exact: true }).waitFor();
    await page.getByLabel("Destination").fill("Portland, ME");
    await page.getByText("Current provider failure", { exact: true }).waitFor({ state: "hidden" });
  } finally { release(); }
});

test("vehicle form rejects invalid account data and accepts valid values", async (t) => {
  const context = await browser.newContext();
  t.after(() => context.close());
  const page = await context.newPage();
  await page.goto(`${origin}/settings`);
  await page.getByLabel("Make", { exact: true }).fill("Test");
  await page.getByLabel("Model", { exact: true }).fill("EV");
  for (const [label, value] of [["Year", "1800"], ["Year", "2024.5"], ["Battery (kWh)", "0"], ["Efficiency (mi/kWh)", "-1"]]) {
    const input = page.getByLabel(label, { exact: true });
    const original = await input.inputValue();
    await input.fill(value);
    await page.getByRole("button", { name: "Add vehicle" }).click();
    assert.equal(await page.getByText("Test EV", { exact: true }).count(), 0);
    await input.fill(original);
  }
  await page.getByRole("button", { name: "Add vehicle" }).click();
  assert.equal(await page.getByText("Test EV", { exact: true }).count(), 1);
  while (await page.getByRole("button", { name: "Remove", exact: true }).count()) {
    await page.getByRole("button", { name: "Remove", exact: true }).first().click();
  }
  await page.getByLabel("Make", { exact: true }).fill("Test");
  await page.getByLabel("Model", { exact: true }).fill("EV");
  await page.getByRole("button", { name: "Add vehicle" }).click();
  assert.equal(await page.getByText("Default", { exact: true }).count(), 1);
});
