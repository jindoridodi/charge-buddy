# Charge Buddy

Next.js App Router + React + TypeScript, with the UI from `design-compose-kit-main`.

## Run locally

Use Node.js 22.12+ (or 24+) and npm.

```sh
npm install
npm run dev
```

Open http://localhost:3000 (or the URL printed in the terminal).

```sh
npm run build     # Build the production application
npm start         # Serve the production build
npm run typecheck
npm test          # HTTP smoke tests; run npm run build first
```

## Project structure

- `src/app/`: Next.js pages, per-page metadata, shared layout, and error pages.
- `src/views/`: The template's interactive page components.
- `src/components/`: Shared UI components, including the browser-only Leaflet map.
- `src/lib/store.tsx` and `src/lib/data.ts`: Demo state and sample data.
- `src/assets/` and `public/`: Images and public assets.

Add your backend endpoints using Next.js Route Handlers, for example `src/app/api/chargers/route.ts` for `/api/chargers`. No database or real authentication has been connected yet.

Login, reservations, listings, favorites, and settings still use demo data and browser localStorage. Map tiles (OpenStreetMap) and Google Fonts need internet access.

## Original project notes



## Ideas
Main Features:
1. Charging Rental Platform (Public chargers + rented private chargers)
2. Calculate which charger is the cheapest in a radius + calculate cost

### Smaller features / ideas
1. Map + Routing
2. Calculate which charger is the cheapest in a radius + calculate cost
3. Connect charging api's (if we can find any public ones lol)
