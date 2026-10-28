import type { PlanningVehicle } from "./types";

export const VEHICLE_CATALOG: PlanningVehicle[] = [
  { id: "tesla-model-3-2023-long-range", name: "Tesla Model 3 Long Range (2023)", usableBatteryKwh: 75, consumptionWhPerMile: 244, connector: "NACS", maxDcKw: 250, chargeCurve: [{ socPercent: 10, powerKw: 250 }, { socPercent: 50, powerKw: 170 }, { socPercent: 80, powerKw: 90 }, { socPercent: 100, powerKw: 20 }], stopOverheadMinutes: 6, precision: "curated" },
  { id: "hyundai-ioniq-5-2024", name: "Hyundai Ioniq 5 (2024)", usableBatteryKwh: 74, consumptionWhPerMile: 294, connector: "CCS", maxDcKw: 235, chargeCurve: [{ socPercent: 10, powerKw: 235 }, { socPercent: 50, powerKw: 180 }, { socPercent: 80, powerKw: 120 }, { socPercent: 100, powerKw: 20 }], stopOverheadMinutes: 7, precision: "curated" },
  { id: "ford-mustang-mach-e-2024", name: "Ford Mustang Mach-E Extended Range (2024)", usableBatteryKwh: 88, consumptionWhPerMile: 300, connector: "CCS", maxDcKw: 150, chargeCurve: [{ socPercent: 10, powerKw: 150 }, { socPercent: 50, powerKw: 115 }, { socPercent: 80, powerKw: 75 }, { socPercent: 100, powerKw: 20 }], stopOverheadMinutes: 7, precision: "curated" },
];

export function vehicleById(id: string) { return VEHICLE_CATALOG.find((vehicle) => vehicle.id === id); }
