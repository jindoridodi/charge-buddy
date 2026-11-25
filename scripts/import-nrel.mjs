import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { normalizeNrelStation } from "../src/lib/catalog/nrel.ts";

nextEnv.loadEnvConfig(process.cwd());

const nrelKey = process.env.NREL_API_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!nrelKey || !url || !serviceKey) throw new Error("NREL_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const endpoint = "https://developer.nlr.gov/api/alt-fuel-stations/v1.json";
const limit = 200;
let imported = 0;
const params = new URLSearchParams({ api_key: nrelKey, fuel_type: "ELEC", access: "public", status: "E", country: "US", limit: "all", _cb: randomUUID() });
const response = await fetch(`${endpoint}?${params}`);
if (!response.ok) throw new Error(`NREL request failed: ${response.status} ${await response.text()}`);
const payload = await response.json();
const stations = payload?.fuel_stations;
const total = payload?.total_results;
if (!Array.isArray(stations) || !Number.isSafeInteger(total) || total <= 0 || stations.length !== total) {
  throw new Error("NREL import incomplete: invalid snapshot; refusing catalog deactivation.");
}
const rows = stations.map(normalizeNrelStation);
if (rows.some((row) => !row || !Number.isSafeInteger(row.nrel_station_id) || row.nrel_station_id <= 0)) {
  throw new Error("NREL import incomplete: invalid station; refusing catalog deactivation.");
}
const importedSourceIds = new Set(rows.map((row) => row.source_external_id));
if (importedSourceIds.size !== total) throw new Error("NREL import incomplete: duplicate or missing station IDs; refusing catalog deactivation.");
for (let offset = 0; offset < rows.length; offset += limit) {
  const batch = rows.slice(offset, offset + limit);
  const { error } = await supabase.from("chargers").upsert(batch, { onConflict: "nrel_station_id" });
  if (error) throw error;
  imported += batch.length;
  process.stdout.write(`Imported ${imported} active public US stations\n`);
}

const staleIds = [];
for (let offset = 0; ; ) {
  const { data: rows, error } = await supabase.from("chargers").select("id, source_external_id").eq("source", "nrel").order("id").range(offset, offset + 99);
  if (error) throw error;
  if (!rows?.length) break;
  staleIds.push(...rows.filter((row) => !row.source_external_id || !importedSourceIds.has(row.source_external_id)).map((row) => row.id));
  offset += rows.length;
}
for (let start = 0; start < staleIds.length; start += 100) {
  const { error } = await supabase.from("chargers").update({ public_access: false, availability_status: "unavailable", imported_at: new Date().toISOString() }).in("id", staleIds.slice(start, start + 100));
  if (error) throw error;
}

console.log(`Done. Imported or updated ${imported} chargers; marked ${staleIds.length} missing NREL records unavailable.`);
