# Current codebase

> **Historical baseline:** This source review describes commit `84f1377` on October 24, 2026. Consult [the documentation router](README.md) and verify current behavior in source before using it for an implementation decision.

Inspected October 24, 2026, at baseline commit `84f1377`. This is a source review plus the command checks below; browser interactions were not exercised during this review.

## Application foundation

| Area | Observed implementation |
| --- | --- |
| Framework | Next.js App Router; manifest `^16.4.1`, installed `16.4.2`. |
| UI runtime | React/React DOM; manifest `^19.2.0`, installed `19.3.1`. |
| Language | TypeScript; manifest `^5.8.3`, installed `5.9.3`; strict compiler options. |
| Styling | Tailwind CSS; manifest `^4.2.1`, installed `4.3.3`; reusable Radix-based UI components. |
| Maps and charts | Leaflet `1.9.4`, OpenStreetMap tiles, and Recharts dashboard charts. |
| Application state | React context in `src/lib/store.tsx`, initialized with fixtures and saved under localStorage key `charge-buddy-state-v1`. |
| Server functionality | Next.js rendering and metadata are present. No application API Route Handlers, database schema, migrations, or real authentication integration were found. |
| Tooling | npm lockfile; development, build, start, typecheck, and HTTP smoke-test scripts. No configured lint script, CI workflow, unit-test suite, or browser E2E suite was found. |

The installed versions above describe this checkout. Use [package.json](../package.json) for declared ranges and [package-lock.json](../package-lock.json) for reproducible dependency resolution. The local check environment was Node `24.12.0` and npm `11.6.2`.

## Where to work

| Path | Responsibility |
| --- | --- |
| [src/app](../src/app) | Ten page routes, metadata, shared root layout, providers, error boundary, and global 404 page. |
| [src/views](../src/views) | Interactive client components for each screen. Most product behavior lives here. |
| [src/lib/data.ts](../src/lib/data.ts) | Domain interfaces, sample chargers/vehicles/bookings, distance, cost, and host-price helpers. |
| [src/lib/store.tsx](../src/lib/store.tsx) | Shared client state, favorites, compare selection, vehicle selection, and browser persistence. |
| [src/components/MapView.tsx](../src/components/MapView.tsx) | Dynamically loads the Leaflet implementation with server rendering disabled. |
| [src/components/MapView.client.tsx](../src/components/MapView.client.tsx) | Tile map, price markers, selection, and optional polyline rendering. |
| [src/components/ChargerCard.tsx](../src/components/ChargerCard.tsx) | Search cards, estimate display, favorites, compatibility warning, and compare selection. |
| [src/components/ui](../src/components/ui) | Existing shared interface primitives; reuse them before adding a component library. |
| [scripts/smoke-test.mjs](../scripts/smoke-test.mjs) | Starts an owned production server, checks HTML responses and assets, then stops that server. |

`src/views/chargers.$id.tsx` is a client view filename. The actual dynamic URL is defined by `src/app/chargers/[id]/page.tsx`.

## Screen inventory

| Route | What exists | What still needs implementation |
| --- | --- | --- |
| `/` | Landing page, featured fixtures, search navigation, simulated location action. | Actual origin selection/geolocation; label or replace unsupported charger-count, savings, and verified-host claims. |
| `/chargers` | List/map, text search, connector/level/power/price/radius/time filters, sorting, favorites, compare selection. | Shared charger source, geocoded origin, road distances, validated availability, and compatible available results. |
| `/chargers/[id]` | Detail/photos/reviews, adjustable estimate, reservation dialog, payment labels. | Persistent detail lookup and true missing-record handling. Booking/payment/calendar actions remain demo extensions. |
| `/compare` | Up to four selected chargers, cost breakdown, best-total badge. | Shared quotes using the user's requested energy and origin; it currently assumes 30 kWh. |
| `/list-charger` | Four-step wizard, rate suggestion, hours, price, and local publish action. | Account enforcement, field validation, address geocoding, server persistence, ownership, and real photo handling. |
| `/route-planner` | Range estimate from battery percentage and a manually entered distance slider; four inexpensive candidate chargers. | Geocode endpoints, obtain road geometry, choose reachable stops along the trip, and render the route. |
| `/auth` | Login/signup forms with basic client checks and simulated reset confirmation. | Identity verification, sessions, real account creation/reset, and server authorization. |
| `/dashboard` | Driver reservations/favorites; host booking decisions, paused listings, totals, earnings chart. | User-scoped queries and persistent mutations. Host requests and driver reservations are separate fixture collections. |
| `/settings` | Profile save, add/remove/default vehicle, preferences, dark theme, reset. | Per-account persistence and validation; units and notification options are saved but do not implement conversion or delivery. |
| `/about` | Product explanation. | Align statements about bookings, payment, and host verification with the actual release scope. |

## Existing data and calculations

The initial store combines 12 sample chargers with two sample "my listings." It also contains two vehicles, four driver reservations, six host bookings, reviews, and an earnings series. This is demonstration data, not imported public-network data. There is no explicit public-versus-peer charger source field or durable user/owner identity.

`distanceMiles` uses Haversine distance from a fixed downtown San Jose origin (`USER_LOC`) unless an explicit distance is supplied to `estimateCost`. This is straight-line distance, not driving distance. Search text does not relocate that origin.

The existing estimate is:

```text
electricity = requested_kWh * charger_price_per_kWh
travel = (2 * one_way_distance_miles / max(vehicle_miles_per_kWh, 0.1)) * 0.32
estimated_total = electricity + flat_host_fee + travel
```

The `0.32` travel electricity rate is a demo constant. "Recommended" search uses `total - rating * 1.5`; "Lowest estimated total cost" sorts purely by the estimate. The best-value badge uses the cheapest currently filtered estimate.

`suggestPrice(homeRate)` returns the larger of `homeRate * 1.4` and `homeRate + 0.05`, rounded to cents. The listing's default submitted price separately uses the saved margin percentage, so the displayed suggestion and default price can disagree.

## Gaps that affect correctness

1. **Accounts and ownership:** all application state belongs to a browser store. Login accepts any email and a password of sufficient length without checking credentials; profile save can also populate `user`. Logout clears only `user`, leaving other state. No trusted account boundary exists.
2. **Persistence:** another device or browser cannot see a newly published charger or saved account data. `ownedByMe` and host names are presentation data, not authorization.
3. **Locations:** new listings receive random coordinates near San Jose. The address privacy hint is not enforced by a server; the data includes the address and coordinates sent to the client.
4. **Compatibility and ranking:** incompatible chargers can remain in search with a warning. Route planning treats any DC Fast charger as eligible even with a different connector. Busy/offline chargers can appear in ordinary results; only the "Available now" filter restricts status.
5. **Routing:** endpoint strings are displayed without geocoding. The selected chargers are not proven to be along the route or reachable at the current state of charge. The map can draw a supplied polyline, but the planner does not supply one.
6. **Reservations:** there are no server checks for overlap, opening days, past dates, energy versus duration/power, or ownership. Only Offline disables the button; Busy does not. Driver reservations do not generate matching host requests.
7. **Money:** the reservation total includes estimated travel energy, which is a driver expense rather than a host/platform charge. Payment choices are labels and no transaction occurs.
8. **Other demo actions:** photo input uses sample photos; password reset and calendar confirmation are toasts. Notifications have no sending service. Several default dates are fixed in October 2026 and can already be in the past.

These are implementation gaps, not failed browser tests from this review. See [Requirements](REQUIREMENTS.md) for required outcomes and [Team plan](TEAM_PLAN.md) for work items.

## Verified baseline

| Check run on October 24, 2026 | Result | What it establishes |
| --- | --- | --- |
| `npm run typecheck` | Passed | The current project passes its TypeScript check. |
| `npm run build` | Passed | Next.js produces a production build. |
| `npm test` after the build | Passed | 13 HTTP route checks, including a global 404, plus stylesheet and hero-image requests. |

The smoke suite inspects server-returned HTML. It does not execute hydrated interactions, render Leaflet, verify localStorage persistence, validate ranking mathematics, or prove authentication/routing correctness. No live integration or deployment was verified.
