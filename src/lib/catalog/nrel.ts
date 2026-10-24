export interface NrelStation {
  id: number;
  station_name?: string;
  street_address?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  ev_network?: string;
  ev_connector_types?: string[];
  ev_dc_fast_num?: number;
  ev_level2_evse_num?: number;
  ev_pricing?: string;
  open_date?: string;
  updated_at?: string;
  status_code?: string;
}

export function normalizeNrelStation(station: NrelStation) {
  if (!station.id || !station.station_name || station.latitude == null || station.longitude == null) return null;
  return {
    nrel_station_id: station.id,
    name: station.station_name.trim(),
    address: station.street_address?.trim() || "Address unavailable",
    city: station.city?.trim() || null,
    state: station.state?.trim() || null,
    zip: station.zip?.trim() || null,
    latitude: station.latitude,
    longitude: station.longitude,
    network: station.ev_network?.trim() || null,
    connector_types: station.ev_connector_types ?? [],
    power_kw: station.ev_dc_fast_num ? null : null,
    operational_status: station.status_code ?? null,
    operator_pricing: station.ev_pricing?.trim() || null,
    source_updated_at: station.updated_at || station.open_date || null,
    imported_at: new Date().toISOString(),
  };
}
