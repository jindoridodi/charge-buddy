export type ReportState = "visible" | "needs_review" | "removed";

export interface CommunityPriceReport {
  id: string;
  charger_id: string;
  reporter_id?: string;
  price_per_kwh: number;
  observed_at: string;
  note: string | null;
  state: ReportState;
  created_at: string;
}

export interface CatalogCharger {
  id: string;
  nrel_station_id: number;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  latitude: number;
  longitude: number;
  network: string | null;
  connector_types: string[];
  power_kw: number | null;
  operational_status: string | null;
  operator_pricing: string | null;
  source_updated_at: string | null;
  imported_at: string;
  price_summary?: PriceSummary;
}

export interface PriceSummary {
  status: "community" | "unknown";
  price_per_kwh: number | null;
  observed_at: string | null;
}
