import { distanceMiles, TRAVEL_RATE_PER_KWH } from "./data";
import type { CatalogCharger } from "./catalog/types";
import type { Coordinates } from "./trips/types";

export function catalogQuote(charger: CatalogCharger, origin: Coordinates | null, kwh: number, efficiency: number) {
  const distance = origin ? distanceMiles(origin, { lat: charger.latitude, lng: charger.longitude }) : 0;
  const price = charger.price_summary?.price_per_kwh;
  return { distance, total: price == null ? null : kwh * price + ("hostFee" in charger && typeof charger.hostFee === "number" ? charger.hostFee : 0) + distance * 2 / efficiency * TRAVEL_RATE_PER_KWH };
}
