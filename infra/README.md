# Self-hosted routing services

ChargeBuddy keeps map/routing credentials server-side. Deploy Valhalla and Nominatim on a dedicated VM behind a private network or reverse proxy; only the Next.js server needs access to them.

## Required service contracts

- `VALHALLA_URL` must expose Valhalla's `POST /route` API and accept `auto` costing with GeoJSON route shapes.
- `NOMINATIM_URL` must expose Nominatim's `GET /search` API. ChargeBuddy restricts requests to U.S. results.
- Both services need U.S. OpenStreetMap extracts. Refresh map data with a versioned operation outside application deploys, validate it in staging, then atomically switch the active dataset.

The application deliberately does not expose either URL as a `NEXT_PUBLIC_*` variable. A missing service produces a typed `provider_unavailable` trip result instead of a misleading route.

## Capacity baseline

Use a VM with SSD-backed persistent volumes for map data and separate memory limits for Valhalla/Nominatim. National extracts are large; size disk and memory from the image/provider documentation before provisioning. Back up Supabase independently from OSM-derived artifacts, which can be rebuilt from their documented source extracts.

## Operations

1. Download licensed U.S. OSM extracts and build the service-specific indexes in a staging volume.
2. Health-check geocoding and a representative route through both services.
3. Set `VALHALLA_URL` and `NOMINATIM_URL` only in the Next.js server environment.
4. Run `npm run import:nrel` on a scheduled worker after the catalog migration.
5. Monitor provider latency/error rates and catalog import freshness. Do not advertise live traffic, weather, availability, or prices.
