import assert from "node:assert/strict";

let imported = false;
const staleRows = Array.from({ length: 1001 }, (_, id) => ({ id: `stale-${String(id).padStart(4, "0")}`, source_external_id: String(id + 100) }));
const deactivated = new Set();
process.on("exit", () => assert.equal(deactivated.size, 1001, "Every missing station must be deactivated, including later pages"));
globalThis.fetch = async (input, options) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === "developer.nrel.gov") {
    assert.equal(url.searchParams.get("api_key"), "test-nrel-key");
    return Response.json({ fuel_stations: [{ id: 1, station_name: " Test station ", latitude: 42, longitude: -71, status_code: "E", ev_dc_fast_num: 1 }] });
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
