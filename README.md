# ChargeBuddy

ChargeBuddy is a Next.js EV-charging marketplace and trip-planning application. It uses Supabase and NREL for charger data, with optional self-hosted Valhalla and Nominatim services for EV route planning.

## Run locally

### 1. Run the web application

Use Node.js 22.12+ (or Node 24+) and npm:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The browse/demo screens work without backend configuration. Configure Supabase and NREL in `.env.local` to use the shared public charger catalog.

```powershell
npm run typecheck
npm run build
npm test              # Run after npm run build
npm run test:catalog
npm run test:trip
```

### 2. Run local routing and geocoding services

The EV Trip Planner requires Valhalla and Nominatim. Docker Desktop must be running.

```powershell
Copy-Item infra/.env.example infra/.env
# Edit infra/.env and replace NOMINATIM_PASSWORD.
Push-Location infra
docker compose --env-file .env up -d
docker compose logs -f valhalla nominatim
Pop-Location
```

The supplied configuration imports California OpenStreetMap data to keep first-run development manageable. The initial data import can take a while. Do not remove the Docker volumes while it is running.

After both services are healthy, set these values in `.env.local`:

```env
VALHALLA_URL=http://127.0.0.1:8002
NOMINATIM_URL=http://127.0.0.1:8080
```

Validate the services:

```powershell
curl http://127.0.0.1:8002/status
curl "http://127.0.0.1:8080/search?format=jsonv2&q=San%20Jose%2C%20CA"
```

Restart `npm run dev`, then use `/route-planner`. See [infra/README.md](infra/README.md) for production and national-import guidance.

### 3. Load the public charger catalog

Create a Supabase project, run the SQL migrations under `supabase/migrations/`, and fill in the Supabase and NREL values in `.env.local`.

```powershell
npm run import:nrel
```

See [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) for the catalog and community-price-report setup.

## Project structure

- `src/app/`: Next.js pages and Route Handlers.
- `src/views/`: Interactive UI screens.
- `src/lib/trips/`: EV vehicle catalog and charging-stop optimizer.
- `src/lib/server/providers/`: Server-only Valhalla and Nominatim adapters.
- `infra/`: Docker Compose routing/geocoding stack.
- `supabase/migrations/`: Supabase schema migrations.
- `docs/`: Requirements, architecture, and delivery guidance.
