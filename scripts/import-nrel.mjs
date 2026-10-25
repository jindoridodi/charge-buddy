import { createClient } from "@supabase/supabase-js";

const nrelKey = process.env.NREL_API_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!nrelKey || !url || !serviceKey) throw new Error("NREL_API_KEY, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const endpoint = "https://developer.nrel.gov/api/alt-fuel-stations/v1.json";
const limit = 200;
let offset = 0;
let imported = 0;

function normalize(station) {
  if (!station.id || !station.station_name || station.latitude == null || station.longitude == null) return null;
  return {
    nrel_station_id: station.id, name: station.station_name.trim(), address: station.street_address?.trim() || "Address unavailable",
    city: station.city?.trim() || null, state: station.state?.trim() || null, zip: station.zip?.trim() || null,
    latitude: station.latitude, longitude: station.longitude, network: station.ev_network?.trim() || null,
    connector_types: station.ev_connector_types ?? [],
    power_kw: station.ev_dc_fast_num ? 50 : station.ev_level2_evse_num ? 7.2 : station.ev_level1_evse_num ? 1.4 : null,
    operational_status: station.status_code ?? null,
    operator_pricing: station.ev_pricing?.trim() || null, source_updated_at: station.updated_at || station.open_date || null,
    imported_at: new Date().toISOString(),
    source: "nrel", source_external_id: String(station.id), public_access: true,
    availability_status: station.status_code === "E" ? "available" : "unknown", opening_hours_confidence: "unknown",
  };
}

while (true) {
  const params = new URLSearchParams({ api_key: nrelKey, fuel_type: "ELEC", access: "public", status: "E", country: "US", limit: String(limit), offset: String(offset) });
  const response = await fetch(`${endpoint}?${params}`);
  if (!response.ok) throw new Error(`NREL request failed: ${response.status} ${await response.text()}`);
  const payload = await response.json();
  const rows = (payload.fuel_stations ?? []).map(normalize).filter(Boolean);
  if (rows.length) {
    const { error } = await supabase.from("chargers").upsert(rows, { onConflict: "nrel_station_id" });
    if (error) throw error;
    imported += rows.length;
  }
  offset += limit;
  process.stdout.write(`Imported ${imported} active public US stations\n`);
  if ((payload.fuel_stations ?? []).length < limit) break;
}
console.log(`Done. Imported or updated ${imported} chargers.`);
