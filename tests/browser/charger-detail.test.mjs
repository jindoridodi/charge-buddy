import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

let server, browser, origin;
const id = "00000000-0000-0000-0000-000000000055";
const charger = { id, name: "Public test station", address: "Boston", connector_types: ["CCS"], operational_status: "E", availability_status: "unknown", imported_at: "2026-11-01T00:00:00Z", price_summary: { status: "unknown", price_per_kwh: null, observed_at: null } };

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
