import assert from "node:assert/strict";

let imported = false;
const scenario = process.env.IMPORT_SCENARIO ?? "single";
const complete = ["single", "complete"].includes(scenario);
const staleRows = Array.from({ length: 1001 }, (_, id) => ({ id: `stale-${String(id).padStart(4, "0")}`, source_external_id: String(id + 10000) }));
const deactivated = new Set();
process.on("exit", () => assert.equal(deactivated.size, complete ? 1001 : 0, "Only complete imports may deactivate missing stations, including later pages"));
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "developer.nrel.gov") {
    assert.equal(url.searchParams.get("api_key"), "test-nrel-key");
    const station = (id) => ({ id, station_name: " Test station ", latitude: 42, longitude: -71, status_code: "E", ev_dc_fast_num: 1 });
    const offset = Number(url.searchParams.get("offset"));
    if (scenario === "single") return Response.json({ total_results: 1, fuel_stations: [station(1)] });
    if (offset === 0) return Response.json({ total_results: 201, offset, fuel_stations: Array.from({ length: 200 }, (_, index) => station(index + 1)) });
    if (scenario === "missing-array") return Response.json({ total_results: 201, offset });
    const payload = { total_results: 201, offset, fuel_stations: [station(201)] };
    if (scenario === "missing-total") delete payload.total_results;
    if (scenario === "wrong-offset") payload.offset = 0;
    if (scenario === "changed-total") payload.total_results = 202;
    if (scenario === "short-page") payload.fuel_stations = [];
    if (scenario === "duplicate") payload.fuel_stations = [station(1)];
    if (scenario === "invalid-row") payload.fuel_stations = [{ id: 201 }];
    return Response.json(payload);
  }
  assert.equal(url.origin, "https://import-test.invalid");
  if (options?.method === "POST") {
    const rows = JSON.parse(options.body);
    assert.equal(rows[0].name, "Test station");
    assert.equal(rows[0].power_kw, 50);
    assert.equal(rows[0].availability_status, "unknown");
    imported = true;
    return Response.json([], { status: 201 });
  }
  assert.ok(imported, "Catalog reconciliation must follow a successful import");
  if (options?.method === "PATCH") {
    for (const id of url.searchParams.get("id").slice(4, -1).split(",")) deactivated.add(id.replaceAll('"', ''));
    return Response.json([]);
  }
  const offset = Number(url.searchParams.get("offset") ?? 0);
  return Response.json(staleRows.slice(offset, offset + Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000)));
};
