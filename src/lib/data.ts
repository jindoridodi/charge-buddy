import charger1 from "@/assets/charger1.jpg";
import charger2 from "@/assets/charger2.jpg";
import charger3 from "@/assets/charger3.jpg";
import hero from "@/assets/hero.jpg";

export const PHOTOS = [charger1.src, charger2.src, charger3.src, hero.src];

export type Connector = "J1772" | "CCS" | "NACS" | "CHAdeMO";
export type Level = "Level 1" | "Level 2" | "DC Fast";
export const CONNECTORS: Connector[] = ["J1772", "CCS", "NACS", "CHAdeMO"];
export const LEVELS: Level[] = ["Level 1", "Level 2", "DC Fast"];

export interface Review {
  author: string;
  rating: number;
  date: string;
  text: string;
}

export interface Charger {
  id: string;
  name: string;
  host: string;
  hostSince: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  pricePerKwh: number;
  hostFee: number;
  connector: Connector;
  level: Level;
  powerKw: number;
  status: "Available" | "Busy" | "Offline";
  rating: number;
  reviewCount: number;
  photos: string[];
  description: string;
  parking: string;
  hours: { start: string; end: string; days: string[] };
  reviews: Review[];
  ownedByMe?: boolean;
  disabled?: boolean;
}

export interface Vehicle {
  id: string;
  nickname: string;
  make: string;
  model: string;
  year: number;
  batteryKwh: number;
  efficiency: number; // mi/kWh
  connector: Connector;
}

export interface Reservation {
  id: string;
  chargerId: string;
  date: string;
  start: string;
  durationHrs: number;
  kwh: number;
  vehicleId: string;
  total: number;
  status: "Upcoming" | "Completed" | "Cancelled";
  payment: string;
}

export interface HostBooking {
  id: string;
  chargerId: string;
  driver: string;
  vehicle: string;
  date: string;
  start: string;
  kwh: number;
  earnings: number;
  status: "Pending" | "Accepted" | "Declined" | "Completed";
}

/** User's home location used for distance (downtown San Jose). */
export const USER_LOC = { lat: 37.3352, lng: -121.8811 };
/** Cost per mile to drive to a charger, derived from avg home electricity. */
export const TRAVEL_RATE_PER_KWH = 0.32;

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const reviewsPool: Review[] = [
  { author: "Priya S.", rating: 5, date: "Sep 2026", text: "Super easy to find and the host was very responsive. Charged my Ioniq 5 while grabbing coffee nearby." },
  { author: "Marcus L.", rating: 4, date: "Aug 2026", text: "Good spot, a bit tight to park but the charger worked perfectly." },
  { author: "Elena R.", rating: 5, date: "Aug 2026", text: "Way cheaper than the public fast chargers. Will be back!" },
  { author: "Tom H.", rating: 4, date: "Jul 2026", text: "Clear instructions and a well-lit driveway. Recommended." },
];

const seed: Array<Omit<Charger, "photos" | "reviews" | "hours" | "hostSince" | "description" | "parking"> & { days?: string[] }> = [
  { id: "c1", name: "Willow Glen Garage Charger", host: "Sarah M.", neighborhood: "Willow Glen", address: "Lincoln Ave, San Jose, CA 95125", lat: 37.3045, lng: -121.8973, pricePerKwh: 0.28, hostFee: 2, connector: "J1772", level: "Level 2", powerKw: 7.7, status: "Available", rating: 4.9, reviewCount: 64 },
  { id: "c2", name: "Rose Garden Tesla Wall", host: "David K.", neighborhood: "Rose Garden", address: "Dana Ave, San Jose, CA 95126", lat: 37.3317, lng: -121.9289, pricePerKwh: 0.32, hostFee: 1.5, connector: "NACS", level: "Level 2", powerKw: 11.5, status: "Available", rating: 4.8, reviewCount: 41 },
  { id: "c3", name: "Japantown Driveway Station", host: "Ken T.", neighborhood: "Japantown", address: "N 5th St, San Jose, CA 95112", lat: 37.3486, lng: -121.8945, pricePerKwh: 0.25, hostFee: 3, connector: "J1772", level: "Level 2", powerKw: 6.6, status: "Busy", rating: 4.6, reviewCount: 28 },
  { id: "c4", name: "Almaden Fast Charge Hub", host: "Linda P.", neighborhood: "Almaden Valley", address: "Almaden Expy, San Jose, CA 95120", lat: 37.2385, lng: -121.8752, pricePerKwh: 0.45, hostFee: 0, connector: "CCS", level: "DC Fast", powerKw: 50, status: "Available", rating: 4.7, reviewCount: 92 },
  { id: "c5", name: "Berryessa Family Charger", host: "Miguel A.", neighborhood: "Berryessa", address: "Piedmont Rd, San Jose, CA 95132", lat: 37.3885, lng: -121.8567, pricePerKwh: 0.22, hostFee: 2.5, connector: "J1772", level: "Level 2", powerKw: 7.2, status: "Available", rating: 4.5, reviewCount: 19 },
  { id: "c6", name: "Cambrian Park Nissan Spot", host: "Grace W.", neighborhood: "Cambrian", address: "Camden Ave, San Jose, CA 95124", lat: 37.2588, lng: -121.9301, pricePerKwh: 0.3, hostFee: 1, connector: "CHAdeMO", level: "DC Fast", powerKw: 25, status: "Available", rating: 4.4, reviewCount: 12 },
  { id: "c7", name: "Evergreen Hillside Charger", host: "Raj N.", neighborhood: "Evergreen", address: "San Felipe Rd, San Jose, CA 95135", lat: 37.3046, lng: -121.7745, pricePerKwh: 0.24, hostFee: 2, connector: "NACS", level: "Level 2", powerKw: 9.6, status: "Available", rating: 4.9, reviewCount: 37 },
  { id: "c8", name: "Downtown Loft Outlet", host: "Jess B.", neighborhood: "Downtown", address: "S 2nd St, San Jose, CA 95113", lat: 37.3318, lng: -121.8863, pricePerKwh: 0.2, hostFee: 1, connector: "J1772", level: "Level 1", powerKw: 1.9, status: "Available", rating: 4.2, reviewCount: 9 },
  { id: "c9", name: "Santa Teresa CCS Station", host: "Omar F.", neighborhood: "Santa Teresa", address: "Santa Teresa Blvd, San Jose, CA 95119", lat: 37.2276, lng: -121.7849, pricePerKwh: 0.42, hostFee: 0.5, connector: "CCS", level: "DC Fast", powerKw: 62.5, status: "Offline", rating: 4.6, reviewCount: 55 },
  { id: "c10", name: "Naglee Park Garage", host: "Hannah C.", neighborhood: "Naglee Park", address: "S 14th St, San Jose, CA 95112", lat: 37.3362, lng: -121.8723, pricePerKwh: 0.27, hostFee: 1.5, connector: "CCS", level: "Level 2", powerKw: 11, status: "Available", rating: 4.8, reviewCount: 33 },
  { id: "c11", name: "West San Jose Wallbox", host: "Steve Y.", neighborhood: "West San Jose", address: "Saratoga Ave, San Jose, CA 95129", lat: 37.3002, lng: -121.9757, pricePerKwh: 0.29, hostFee: 2, connector: "NACS", level: "Level 2", powerKw: 11.5, status: "Busy", rating: 4.7, reviewCount: 48 },
  { id: "c12", name: "North San Jose Tech Hub", host: "Anita V.", neighborhood: "North San Jose", address: "N 1st St, San Jose, CA 95134", lat: 37.4084, lng: -121.9426, pricePerKwh: 0.35, hostFee: 1, connector: "CCS", level: "DC Fast", powerKw: 50, status: "Available", rating: 4.5, reviewCount: 71 },
];

export const MOCK_CHARGERS: Charger[] = seed.map((c, i) => ({
  ...c,
  hostSince: `${2021 + (i % 4)}`,
  photos: [PHOTOS[i % 3]!, PHOTOS[(i + 1) % 4]!, PHOTOS[(i + 2) % 3]!],
  description: `A well-maintained ${c.level} ${c.connector} charger in a quiet ${c.neighborhood} neighborhood. Delivers up to ${c.powerKw} kW, perfect for topping up while you run errands nearby.`,
  parking: "Pull into the right side of the driveway. The cable reaches both sides. Please don't block the sidewalk.",
  hours: { start: i % 2 ? "07:00" : "06:00", end: i % 3 ? "22:00" : "23:00", days: i % 4 === 0 ? ALL_DAYS.slice(0, 5) : ALL_DAYS },
  reviews: reviewsPool.slice(0, 2 + (i % 3)),
}));

export const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "v1", nickname: "Daily Driver", make: "Tesla", model: "Model 3", year: 2023, batteryKwh: 75, efficiency: 4.1, connector: "NACS" },
  { id: "v2", nickname: "Family SUV", make: "Hyundai", model: "Ioniq 5", year: 2024, batteryKwh: 77.4, efficiency: 3.4, connector: "CCS" },
];

export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface CostBreakdown {
  electricity: number;
  hostFee: number;
  travel: number;
  total: number;
  distance: number;
}

/** Estimated total charging cost: energy + host fee + round-trip travel energy. */
export function estimateCost(
  charger: Pick<Charger, "pricePerKwh" | "hostFee" | "lat" | "lng">,
  kwh: number,
  efficiency: number,
  distanceOverride?: number,
): CostBreakdown {
  const distance = distanceOverride ?? distanceMiles(USER_LOC, charger);
  const electricity = kwh * charger.pricePerKwh;
  const travel = ((distance * 2) / Math.max(efficiency, 0.1)) * TRAVEL_RATE_PER_KWH;
  const total = electricity + charger.hostFee + travel;
  return { electricity, hostFee: charger.hostFee, travel, total, distance };
}

/** Suggested host listing price: electricity cost plus 40% margin, min +$0.05. */
export function suggestPrice(homeRate: number) {
  const suggested = Math.max(homeRate * 1.4, homeRate + 0.05);
  return { suggested: Math.round(suggested * 100) / 100, profit: Math.round((suggested - homeRate) * 100) / 100 };
}

export const money = (n: number) => `$${n.toFixed(2)}`;

export const MOCK_HOST_BOOKINGS: HostBooking[] = [
  { id: "hb1", chargerId: "mine-1", driver: "Alex J.", vehicle: "Tesla Model Y", date: "2026-10-16", start: "18:00", kwh: 30, earnings: 11.4, status: "Pending" },
  { id: "hb2", chargerId: "mine-1", driver: "Bianca R.", vehicle: "Chevy Bolt", date: "2026-10-18", start: "09:30", kwh: 25, earnings: 9.5, status: "Accepted" },
  { id: "hb3", chargerId: "mine-2", driver: "Chris D.", vehicle: "Kia EV6", date: "2026-10-20", start: "13:00", kwh: 40, earnings: 15.2, status: "Pending" },
  { id: "hb4", chargerId: "mine-1", driver: "Dana P.", vehicle: "Ford Mach-E", date: "2026-10-05", start: "08:00", kwh: 35, earnings: 13.3, status: "Completed" },
  { id: "hb5", chargerId: "mine-2", driver: "Evan T.", vehicle: "Rivian R1S", date: "2026-10-02", start: "19:00", kwh: 50, earnings: 19, status: "Completed" },
  { id: "hb6", chargerId: "mine-1", driver: "Fiona G.", vehicle: "Nissan Leaf", date: "2026-09-28", start: "12:00", kwh: 20, earnings: 7.6, status: "Completed" },
];

export const EARNINGS_HISTORY = [
  { month: "May", earnings: 84 },
  { month: "Jun", earnings: 121 },
  { month: "Jul", earnings: 156 },
  { month: "Aug", earnings: 142 },
  { month: "Sep", earnings: 188 },
  { month: "Oct", earnings: 97 },
];

export const MY_LISTINGS: Charger[] = [
  { ...MOCK_CHARGERS[0]!, id: "mine-1", name: "My Garage Charger", host: "You", neighborhood: "Willow Glen", lat: 37.31, lng: -121.89, ownedByMe: true },
  { ...MOCK_CHARGERS[9]!, id: "mine-2", name: "Driveway CCS Port", host: "You", neighborhood: "Naglee Park", lat: 37.34, lng: -121.866, ownedByMe: true },
];

export const MOCK_RESERVATIONS: Reservation[] = [
  { id: "CB-48213", chargerId: "c2", date: "2026-10-17", start: "10:00", durationHrs: 3, kwh: 30, vehicleId: "v1", total: 12.4, status: "Upcoming", payment: "Visa •••• 4242" },
  { id: "CB-47102", chargerId: "c1", date: "2026-10-03", start: "08:00", durationHrs: 4, kwh: 28, vehicleId: "v1", total: 10.3, status: "Completed", payment: "Visa •••• 4242" },
  { id: "CB-46550", chargerId: "c10", date: "2026-09-22", start: "17:00", durationHrs: 2, kwh: 20, vehicleId: "v2", total: 7.9, status: "Completed", payment: "Apple Pay" },
  { id: "CB-45901", chargerId: "c4", date: "2026-09-15", start: "12:00", durationHrs: 1, kwh: 40, vehicleId: "v2", total: 19.1, status: "Cancelled", payment: "Visa •••• 4242" },
];
