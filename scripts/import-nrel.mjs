import { createClient } from "@supabase/supabase-js";
import nextEnv from "@next/env";
import { normalizeNrelStation } from "../src/lib/catalog/nrel.ts";

nextEnv.loadEnvConfig(process.cwd());

const nrelKey = process.env.NREL_API_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!nrelKey || !url || !serviceKey) throw new Error("NREL_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const endpoint = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json";
const limit = 200;
let offset = 0;
let imported = 0;
const importedSourceIds = new Set();

while (true) {
  const params = new URLSearchParams({ api_key: nrelKey, fuel_type: "ELEC", access: "public", status: "E", country: "US", limit: String(limit), offset: String(offset) });
  const response = await fetch(`${endpoint}?${params}`);
  if (!response.ok) throw new Error(`NREL request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const rows = (payload.fuel_stations ?? []).map(normalizeNrelStation).filter(Boolean);
  if (rows.length) {
    const { error } = await supabase.from("chargers").upsert(rows, { onConflict: "nrel_station_id" });
    if (error) throw error;
    imported += rows.length;
    for (const row of rows) importedSourceIds.add(row.source_external_id);
  }
  offset += limit;
  process.stdout.write(`Imported ${imported} active public US stations\n`);
  if ((payload.fuel_stations ?? []).length < limit) break;
}

if (!importedSourceIds.size) throw new Error("NREL returned no valid stations; refusing to mark existing catalog entries unavailable.");

const { data: existingRows, error: existingError } = await supabase.from("chargers").select("id, source_external_id").eq("source", "nrel");
if (existingError) throw existingError;
const staleIds = (existingRows ?? []).filter((row) => !row.source_external_id || !importedSourceIds.has(row.source_external_id)).map((row) => row.id);
for (let start = 0; start < staleIds.length; start += 1000) {
  const { error } = await supabase.from("chargers").update({ public_access: false, availability_status: "unavailable", imported_at: new Date().toISOString() }).in("id", staleIds.slice(start, start + 1000));
  if (error) throw error;
}

console.log(`Done. Imported or updated ${imported} chargers; marked ${staleIds.length} missing NREL records unavailable.`);
