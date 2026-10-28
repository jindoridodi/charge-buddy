export type ConnectorType = "J1772" | "CCS" | "NACS" | "CHAdeMO";
export type TripObjective = "fastest" | "lowest_cost";
export type TripOutcome = "feasible" | "no_feasible_plan" | "search_bounds_reached" | "provider_unavailable";

export interface Coordinates { lat: number; lng: number; }

export interface ChargeCurvePoint { socPercent: number; powerKw: number; }

export interface PlanningVehicle {
  id: string;
  name: string;
  usableBatteryKwh: number;
  consumptionWhPerMile: number;
  connector: ConnectorType;
  maxDcKw: number;
  chargeCurve: ChargeCurvePoint[];
  stopOverheadMinutes: number;
  precision: "curated" | "custom";
}

export interface PlanningCharger {
  id: string;
  name: string;
  location: Coordinates;
  connectorTypes: string[];
  powerKw: number | null;
  pricePerKwh: number | null;
  source: "nrel" | "peer";
  sourceUpdatedAt: string | null;
  availability: "available" | "unknown" | "unavailable";
  publicAccess: boolean;
}

export interface TripStop {
  chargerId: string;
  chargerName: string;
  location: Coordinates;
  arrivalSocPercent: number;
  departureSocPercent: number;
  energyAddedKwh: number;
  chargeMinutes: number;
  pricePerKwh: number | null;
  estimatedChargeCost: number | null;
  source: "nrel" | "peer";
}

export interface PlannedTrip {
  outcome: TripOutcome;
  objective: TripObjective;
  route: Coordinates[];
  distanceMiles?: number;
  driveMinutes?: number;
  chargeMinutes?: number;
  estimatedCost?: number | null;
  stops: TripStop[];
  warnings: string[];
  assumptions: string[];
  dataFreshness: string | null;
}
