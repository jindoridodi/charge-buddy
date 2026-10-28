import { distanceMiles, type Charger } from "../data";
import type { Coordinates } from "../trips/types";

export function filterLocalListings(listings: Charger[], filters: {
  query: string; origin: Coordinates | null; radius: number; connectors: string[]; levels: string[];
  maxPrice: number; minPower: number; operational: boolean;
}) {
  const query = filters.query.trim().toLowerCase();
  return listings.filter((charger) => !charger.disabled
    && (!query || [charger.name, charger.address, charger.neighborhood].some((value) => value.toLowerCase().includes(query)))
    && (!filters.origin || distanceMiles(filters.origin, charger) <= filters.radius)
    && (!filters.connectors.length || filters.connectors.includes(charger.connector))
    && (!filters.levels.length || filters.levels.includes(charger.level))
    && charger.pricePerKwh <= filters.maxPrice && charger.powerKw >= filters.minPower
    && (!filters.operational || charger.status !== "Offline"));
}
