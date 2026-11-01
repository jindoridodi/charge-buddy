# Self-hosted routing services

ChargeBuddy includes a Docker Compose stack for Valhalla and Nominatim. Both APIs bind to `127.0.0.1` by default, so they are available to the application server on the VM but are not public internet services.

## Start the stack

On the routing VM, install Docker plus the Compose plugin, then:

```bash
cd /srv/chargebuddy
cp /path/to/charge-buddy/infra/docker-compose.yml .
cp /path/to/charge-buddy/infra/.env.example .env
# Edit .env: set a long NOMINATIM_PASSWORD and choose an OSM extract.
docker compose --env-file .env up -d
docker compose logs -f valhalla nominatim
```

The first boot downloads the chosen OSM PBF and imports/builds data. Do not restart or delete the named volumes while that work is running. Start with the California URL in `.env.example`; replacing it with the U.S. extract is a new, much larger import and needs VM capacity planning.

## Validate and connect ChargeBuddy

```bash
curl -fsS http://127.0.0.1:8002/status
curl -fsS "http://127.0.0.1:8080/search?format=jsonv2&q=San%20Jose%2C%20CA"
```

When ChargeBuddy runs on the same VM, set its server-only `.env.local` values to:

```env
VALHALLA_URL=http://127.0.0.1:8002
NOMINATIM_URL=http://127.0.0.1:8080
```

If ChargeBuddy runs on another host, preserve the loopback binding and connect the hosts with a private VPC/VPN plus an authenticated reverse proxy. Never expose either port directly to the public internet.

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
