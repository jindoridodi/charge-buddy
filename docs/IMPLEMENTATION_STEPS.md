# Step-by-step instructions to complete Charge Buddy

> **Planning snapshot:** This is an October 24, 2026 implementation sequence, not a record of completed work. Consult [the documentation router](README.md) and verify current behavior before taking a step.

This is the execution checklist for a team of two. Start with the existing interface and replace its simulated data and actions in the order below. Steps are plans, not features already implemented. Follow [Requirements](REQUIREMENTS.md) for acceptance and [SDLC](SDLC.md) for review, release, and maintenance.

Developer A leads accounts/data/hosting. Developer B leads costs/search/maps/routing. Assign names before starting. The example [team schedule](TEAM_PLAN.md) has estimates and dependencies; it is not a fixed deadline.

## Step 1: Run and inspect the existing project together

**Owners:** both. **Task:** T01.

1. Open a terminal in the repository root and use the Node version agreed by the team. The reviewed baseline passed on Node `24.12.0`.
2. On a fresh checkout, install exactly the lockfile dependencies, then run the existing checks:

   ```sh
   npm ci
   npm run typecheck
   npm run build
   npm test
   npm run dev
   ```

3. Open the URL printed by the development server. Walk through all ten routes in [Current state](CURRENT_STATE.md#screen-inventory).
4. Publish a demo charger and save a favorite. Open a different browser to see the present lack of shared storage.
5. Read `AGENTS.md` and the relevant installed Next.js guides listed in [Architecture](ARCHITECTURE.md) before writing implementation code.

**Complete when:** both developers can start the project, reproduce the baseline, and explain the difference between the UI prototype and the required shared application.

## Step 2: Agree scope and create the working board

**Owners:** both. **Task:** T01.

1. Review proposal sections 1.1-1.4 and FR-01 through FR-09.
2. Choose an initial region, test trips, public-data source, and delivery date based on actual availability.
3. Decide database/auth integration, geocoding/routing services, quotas, travel-rate assumption, distance definition, connector policy, and address disclosure.
4. Record ADR-01 through ADR-05 in [Architecture](ARCHITECTURE.md#decision-log).
5. Create tasks T01-T17 on the shared board with owner, reviewer, requirement ID, and completion evidence.
6. Defer real payments/hardware and decide which demo extras will be labeled or disabled.

**Complete when:** every required feature has an owner and testable outcome, and the team has a realistic core scope.

## Step 3: Define contracts and create persistent storage

**Lead:** A; B reviews. **Task:** T02.

1. Separate reusable domain types from sample data and image imports currently in `src/lib/data.ts`. Agree request/response/error shapes with B before either side implements them.
2. Create the proposed domain/server/provider/client directories described in [Architecture](ARCHITECTURE.md#proposed-code-organization).
3. Add the selected database integration and migrations for profiles, vehicles, preferences, chargers, locations, availability, and favorites. Add explicit user/owner IDs and a peer/public source field.
4. Add constraints for valid values, unique favorites, and owned default vehicles. Choose decimal precision for prices and UTC/timezone conventions.
5. Create `.env.example` with names and setup explanations only; add actual local secrets to ignored environment files.
6. Write a deterministic regional seed/import. Keep fixtures clearly separate from real account records.
7. Document the actual migration and seed commands once implemented; do not invent tool commands before choosing the tooling.

**Complete when:** a fresh empty test database can be migrated and seeded using documented commands, with no hidden setup.

## Step 4: Prove location and road-provider integration early

**Lead:** B; A reviews. **Tasks:** T07, early T10.

1. Implement server-only adapters for endpoint geocoding, road distances, and route geometry using the chosen services.
2. Prove two known addresses resolve correctly and a known trip returns a road line and distance.
3. Normalize units and coordinate ordering. Obtain outbound and return distances for discovery cost when supported.
4. Add request limits, timeouts, typed errors, and deterministic fixture responses.
5. Provide A with the listing geocoder contract so host publishing can continue independently.

**Complete when:** the services return normalized results and failures can be tested without live API calls. Tiles alone do not complete this step.

## Step 5: Replace demo authentication

**Lead:** A; B reviews. **Task:** T03.

1. Integrate the chosen supported auth/session system and its required routes/configuration.
2. Connect `src/views/auth.tsx` to real sign-up/sign-in/sign-out behavior. Implement actual reset if supported or remove the simulated success action from the functional flow.
3. Create/link the internal profile using the verified identity; never trust a posted user ID as proof of identity.
4. Add shared server session and ownership checks before exposing private reads/writes.
5. Update `src/components/Layout.tsx` to use the real account lifecycle. Clear private client state on sign-out and account change.
6. Remove the ability for profile save or localStorage edits to establish a trusted account.

**Complete when:** a real account can sign in again, invalid credentials fail, and anonymous host publishing is rejected by the server.

## Step 6: Persist vehicles, favorites, profile, and preferences

**Lead:** A; B reviews. **Task:** T04.

1. Implement the `/api/me`, vehicle, and favorite contracts with validation and user scoping.
2. Connect `src/views/settings.tsx`, favorites on cards/detail, and default-vehicle selection to those APIs.
3. Keep only transient UI state in `src/lib/store.tsx`; do not use browser-owned fixtures as the source of account data.
4. Validate battery size, efficiency, connector, and default vehicle ownership. Define deletion behavior for the current default vehicle.
5. Make supported settings work across the app. Implement unit display conversion if keeping the units switch; label or remove notification switches until delivery exists.
6. Test A's saved data in another browser, then sign in as B and confirm isolation.

**Complete when:** FR-02 works across browsers and account switching cannot reveal another user's data.

## Step 7: Centralize costs, compatibility, and suggested price

**Lead:** B; A reviews. **Task:** T08.

1. Move `estimateCost`, `suggestPrice`, and compatibility rules into pure domain modules that do not import fixtures/images.
2. Validate explicit origin/distance, requested kWh, efficiency, rates, and fees. Use the agreed precision/rounding policy.
3. Implement the discovery formula in [Architecture](ARCHITECTURE.md#cost-rules), returning electricity, fee, payable subtotal, travel, total, and assumptions.
4. Replace the hardcoded universal travel rate with an explicit supported input/default.
5. Use one host-price rule for the suggestion and default saved price. Preserve the host's explicit override.
6. Add the hand-calculated price/ranking cases TC-04 through TC-08 before wiring all screens.

**Complete when:** numeric cases pass and a lower electricity rate does not incorrectly win when its total cost is higher.

## Step 8: Publish and manage real host listings

**Lead:** A; B reviews. **Task:** T05.

1. Implement create/update/pause APIs with server validation and session-derived ownership.
2. Connect `src/views/list-charger.tsx` to persistence. Replace random coordinates with the geocoder from Step 4.
3. Validate required fields, connector/power, prices/fees, opening days/times, timezone, and location.
4. Apply the shared price rule from Step 7. Persist exactly the price the host confirms.
5. Implement authorized edits and the pause control in `src/views/dashboard.tsx`.
6. Enforce the address-disclosure decision in server responses; a client hint cannot provide privacy.
7. Keep photos explicitly marked as placeholders until uploads exist.

**Complete when:** host A publishes, another browser retrieves the listing, A can edit/pause it, and B cannot modify it.

## Step 9: Build a shared public and peer charger catalog

**Lead:** A; B reviews. **Task:** T06.

1. Import the chosen regional public data with attribution, source IDs, update dates, and known price/availability gaps.
2. Implement paginated catalog and detail APIs using public-safe fields.
3. Combine public records with published peer listings. Exclude paused listings and handle deleted/missing records consistently.
4. Preserve unknown prices/status rather than converting them to zero/available.
5. Replace fixture lookups in charger detail and dashboard queries with the API/data service.
6. Return a true missing-record response instead of only a successful page containing "not found."

**Complete when:** two browsers query the same catalog with correct source labels and sanitized detail data.

## Step 10: Complete origin-based search and cost comparison

**Lead:** B; A reviews. **Task:** T09.

1. Connect the home search and `src/views/chargers.index.tsx` to actual origin selection/geocoding. Offer an explicit fallback if browser geolocation is unavailable or denied.
2. Apply compatibility, recorded availability, one-way driving radius, and other supported filters before ranking.
3. Implement the shared quote API/service using explicit vehicle, energy, origin, and travel-rate inputs.
4. Update `ChargerCard`, charger detail, and `src/views/compare.tsx` to use consistent quotes. Let the requested energy replace the hidden 30 kWh assumption.
5. Keep cheapest-total ranking distinct from any rating-based recommendation and label the objective.
6. Wire catalog markers to list selection and retain usable empty/loading/error states and a map-failure list fallback.

**Complete when:** changing origin or requested energy changes estimates appropriately, and list/detail/compare agree on the same case.

## Step 11: Implement real road routes

**Lead:** B; A reviews. **Task:** T10.

1. Finish the road-route adapter and `/api/trips` request contract.
2. Accept start/destination, vehicle assumptions, battery percentage, reserve, and detour limit.
3. Return validated geometry, road mileage, and explicit provider/no-route/invalid-input errors.
4. Define candidate/stop limits for the bounded first-release search; document them in ADR-05.
5. Add geometry-order and timeout/no-route contract checks.

**Complete when:** a real pair of endpoints determines the road trip; the mileage slider is no longer its source of truth.

## Step 12: Compute feasible charging stops

**Lead:** B; A reviews. **Task:** T11.

1. Select compatible published candidates within the route's allowed detour.
2. Evaluate road legs using battery capacity, efficiency, current energy, and minimum reserve. Check subsequent legs, not only the first charger.
3. Calculate required charging amounts without exceeding capacity; account for detour, fees, estimated charging time, and opening windows.
4. Select the lowest evaluated feasible cost under the documented bounds. Do not describe a heuristic as globally optimal.
5. Return a legitimate no-stop result when possible, or an explicit no-feasible-plan result when no evaluated sequence works.
6. Test exact-reserve, insufficient-range, closed/incompatible stop, capacity limit, and multi-stop cases in [Testing](TESTING.md).

**Complete when:** every returned leg is feasible under the stated assumptions and failures never masquerade as successful routes.

## Step 13: Connect the trip UI and map

**Lead:** B; A reviews. **Task:** T12.

1. Replace the local arithmetic in `src/views/route-planner.tsx` with the trip API.
2. Pass normalized geometry into the existing map's `route` prop and render recommended stop markers.
3. Show leg distance, stop energy, battery estimates, approximate time/cost, and search/availability assumptions.
4. Provide distinct loading, invalid location, provider failure, no-stop, and no-plan states.
5. Verify the route remains usable at mobile widths and with keyboard input.

**Complete when:** the user can plan and inspect a road trip with feasible stops on the map, satisfying FR-08 and FR-09.

## Step 14: Remove misleading demo behavior and finish access/privacy checks

**Lead:** A; B reviews. **Tasks:** T13-T14.

1. Review every screen against [Current state](CURRENT_STATE.md#gaps-that-affect-correctness).
2. Label/disable unsupported reservation, payment, calendar, notification, photo, and verification actions. Replace unsupported count/savings claims.
3. Test unauthenticated and cross-user reads/writes, public location disclosure, default vehicle ownership, and private cache clearing.
4. Test invalid numbers, invalid schedules, stale/deleted IDs, empty results, and persistent data after a server/database restart.
5. Record the evidence against the FR/NFR checklist.

**Complete when:** required workflows are real and the release clearly describes which extras remain demonstrations.

## Step 15: Automate verification and run acceptance

**Owners:** A for integration/CI, B for domain/browser tests. **Tasks:** T14-T16.

1. Add chosen domain/API/browser tools and actual npm scripts; document the commands.
2. Run deterministic numerical and battery cases, two-account persistence, shared listing discovery, consistent quotes, and routed-trip browser flows.
3. Configure CI to install from the lockfile, prepare test data, typecheck, run new checks, build, and execute the existing smoke tests plus core browser checks.
4. Run mobile/desktop and keyboard checks; measure the proposed latency/timeout targets on the selected pilot environment.
5. Complete a separately configured live-provider smoke and record the dataset/date and limitations.
6. Fix blockers and rerun affected checks. Keep optional work behind the completed core acceptance gate.

**Complete when:** all FR-01 through FR-09 and the agreed NFR checks have reproducible passing evidence.

## Step 16: Deploy, demonstrate, and hand over

**Owners:** both. **Tasks:** T16-T17.

1. Follow the deployment/recovery phase in [SDLC](SDLC.md). Use a server-capable environment and separate staging data/configuration.
2. Test fresh migration/seed/setup and a staging backup/restore; record the release commit and migration version.
3. Deploy the reviewed version and check core endpoints, logs, account sessions, and trip provider behavior.
4. Demonstrate host publication -> separate-driver discovery -> itemized comparison -> saved account data -> feasible road trip -> rejected unauthorized edit.
5. Update the current-state inventory, setup instructions, ADRs, known limitations, and final test/release evidence.
6. Assign maintenance ownership and retain recovery instructions. Only then consider optional reservations/uploads/notifications as new scoped work.

**Complete when:** the team can reproduce setup, demonstrate every proposal requirement, identify remaining limitations, and recover the deployed version.
