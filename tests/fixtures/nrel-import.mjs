import assert from "node:assert/strict";

let imported = false;
const scenario = process.env.IMPORT_SCENARIO ?? "single";
const complete = ["single", "complete"].includes(scenario);
const staleRows = Array.from({ length: 1001 }, (_, id) => ({ id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`, source_external_id: String(id + 10000) }));
const deactivated = new Set();
const cacheKeys = new Set();
process.on("exit", () => assert.equal(deactivated.size, complete ? 1001 : 0, "Only complete imports may deactivate missing stations, including later pages"));
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "developer.nlr.gov") {
    assert.equal(url.searchParams.get("api_key"), "test-nrel-key");
    const cacheKey = url.searchParams.get("_cb");
    assert.ok(cacheKey && !cacheKeys.has(cacheKey), "Every NREL page must bypass stale cached responses");
    cacheKeys.add(cacheKey);
    const station = (id) => ({ id, station_name: " Test station ", latitude: 42, longitude: -71, status_code: "E", ev_dc_fast_num: 1 });
    assert.equal(url.searchParams.get("limit"), "all", "Import must use a single source snapshot");
    if (scenario === "single") return Response.json({ total_results: 1, fuel_stations: [station(1)] });
    if (scenario === "missing-array") return Response.json({ total_results: 201 });
    const payload = { total_results: 201, fuel_stations: Array.from({ length: 201 }, (_, index) => station(index + 1)) };
    if (scenario === "missing-total") delete payload.total_results;
    if (scenario === "wrong-total") payload.total_results = 202;
    if (scenario === "short-page") payload.fuel_stations = [];
    if (scenario === "duplicate") payload.fuel_stations[200] = station(1);
    if (scenario === "invalid-row") payload.fuel_stations[200] = { id: 201 };
    return Response.json(payload);
  }
  assert.equal(url.origin, "https://import-test.invalid");
  if (options?.method === "POST") {
    assert.ok(complete, "Invalid snapshots must not write catalog records");
    const rows = JSON.parse(options.body);
    assert.equal(rows[0].name, "Test station");
    assert.equal(rows[0].power_kw, 50);
    assert.equal(rows[0].availability_status, "unknown");
    imported = true;
    return Response.json([], { status: 201 });
  }
  assert.ok(imported, "Catalog reconciliation must follow a successful import");
  if (options?.method === "PATCH") {
    assert.ok(url.href.length < 8000, "Reconciliation requests must fit ordinary URL size limits");
    for (const id of url.searchParams.get("id").slice(4, -1).split(",")) deactivated.add(id.replaceAll('"', ''));
    return Response.json([]);
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  return Response.json(staleRows.slice(offset, offset + Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000)));
};
