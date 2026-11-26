# ChargeBuddy

ChargeBuddy is a Next.js EV-charging marketplace and trip-planning application. It uses Supabase and NREL for charger data, with optional self-hosted Valhalla and Nominatim services for EV route planning.

## Run locally

### 1. Run the web application

Use Node.js 24.12.0 (the CI version) and npm. From the repository root:

```powershell
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app starts without a `.env.local` file; browse and demo screens are available without backend services. To use hosted data, create `.env.local` with the Supabase values from `.env.example`. The NREL API key is only needed when importing or refreshing the catalog, not to run the app. Restart the dev server after changing environment values.

```powershell
npm run typecheck
npm run test:unit     # All focused suites; no backend configuration needed
npm run build
npm test              # Run after npm run build
```

Run one suite with `npm run test:catalog`, `test:account-state`, `test:reports`, `test:rate-limit`, or `test:trip`. CI runs these checks on Linux and Windows from a clean lockfile install. See [Testing](docs/TESTING.md) for coverage and the Windows sandbox workaround.

### 2. Enable trip routing (optional)

Trip planning needs routing and geocoding providers. For a hosted setup, add `STADIA_MAPS_API_KEY` to `.env.local`; see [infra/README.md](infra/README.md) for provider details. For a self-hosted setup, Docker Desktop must be running. The supplied Compose configuration downloads and imports the nationwide U.S. OpenStreetMap extract, which needs substantial disk space, memory, and initial import time.

```powershell
Copy-Item infra/.env.example infra/.env
# Edit infra/.env and replace NOMINATIM_PASSWORD.
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
docker compose --env-file infra/.env -f infra/docker-compose.yml logs -f valhalla nominatim
```

Wait for both services to finish importing data and become healthy. Do not remove their Docker volumes while the import is running. Add these local provider URLs to `.env.local`:

```env
VALHALLA_URL=http://127.0.0.1:8002
NOMINATIM_URL=http://127.0.0.1:8080
```

Check the services:

```powershell
curl http://127.0.0.1:8002/status
curl "http://127.0.0.1:8080/search?format=jsonv2&q=San%20Jose%2C%20CA"
```

Restart `npm run dev`, then open `/route-planner`. See [infra/README.md](infra/README.md) for production and routing-service operations.

### 3. Load the public charger catalog

Create a Supabase project, run the SQL migrations under `supabase/migrations/`, and set the Supabase values in `.env.local`. To populate or refresh the public charger catalog, also set `NREL_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, then run:

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
