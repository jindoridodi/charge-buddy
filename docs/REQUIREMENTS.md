# Requirements and acceptance criteria

The source is *Project_Proposal.pdf*: hosting and pricing in section 1.1, optimization in 1.2, mapping/routing in 1.3, and accounts/saved data in 1.4. The outcomes below translate those requirements into proposed, testable acceptance criteria. The [current-state inventory](CURRENT_STATE.md) records what already exists.

## Product scope

Drivers should find a compatible, available charger using a transparent total-cost estimate and plan a trip with feasible charging stops. Hosts should publish a home charger with a suggested price derived from their electricity rate. Accounts should retain vehicle profiles, favorites, and settings across sessions and devices.

For a two-person first release, use a bounded San Jose/Bay Area demonstration dataset and test trips. This is a proposed delivery boundary, not a change to the proposal's longer-term national ambition. Support both peer listings and a clearly attributed public-charger dataset. A live national feed is a later integration unless the team specifically selects it.

## Required feature checklist

All FR items below are required for the proposal-complete release. Existing demo behavior is a starting point, not a completed acceptance test.

| ID | Proposal source | Current starting point | Proposed acceptance criteria |
| --- | --- | --- | --- |
| FR-01 Accounts | 1.4 | Demo login/signup/reset UI. | Create an account, sign out, sign back in, and establish a server-verified session. Invalid credentials fail. An unauthenticated request cannot publish a charger. |
| FR-02 Saved account data | 1.4 | Browser-local profile, vehicles, settings, and favorites. | Battery kWh, efficiency in mi/kWh, connector, default vehicle, favorites, and supported settings persist in another browser after sign-in. Account B cannot read/change Account A's private data. |
| FR-03 Host listings | 1.1 and 1.4 | Local listing wizard and pause switch. | An authenticated host creates a validated listing with a real geocoded location, connector, power, hours, energy price, and fee. Another browser sees it. Only its owner can edit or pause it. |
| FR-04 Suggested host price | 1.1 | Suggestion helper; separate default-price calculation. | A valid electricity rate produces one consistent, explained suggested price. The host can override it. The saved and displayed price agree and invalid numeric inputs are rejected. |
| FR-05 Map and charger catalog | 1.1 and 1.3 | Leaflet map with sample chargers. | Persisted peer listings and attributed public records appear on a map and list. Selecting a marker identifies the same result. Paused listings are excluded from discovery. Source and freshness limitations are visible. |
| FR-06 Area and connector search | 1.2 | Fixture text/radius/connector filters. | User-selected origin controls the search. Compatible, available chargers within the chosen maximum one-way driving distance are returned. No-result and invalid-location states are clear. |
| FR-07 Total-cost optimization | 1.2 | Client estimate and 30 kWh comparison. | For the same origin, vehicle, energy, and availability assumptions, rank eligible chargers by electricity + charger fee + round-trip travel energy cost. Show each component, distance basis, and assumptions; list/detail/compare agree. |
| FR-08 Point-to-point route | 1.3 | Text endpoints and manual mileage slider. | Valid start and destination produce road geometry, road distance, and a visible map route. Invalid/unreachable endpoints and provider failures produce actionable states. |
| FR-09 Charging-stop plan | 1.3 | Range arithmetic and locally cheap candidates. | Stops lie on or within a configured detour of the trip, match the vehicle connector, are reachable before violating a battery reserve, and allow subsequent legs to reach the destination. Report no feasible plan when necessary. |

The strict connector match in FR-06/FR-09 is a proposed first-release rule. Adapter-aware compatibility requires explicit vehicle/adapter data and should follow later; charger level alone must not imply compatibility.

## Trace requirements to implementation and evidence

Task definitions are in [Team plan](TEAM_PLAN.md); test cases are in [Testing](TESTING.md). These references identify planned coverage, not completed tests.

| Requirement | Implementation tasks | Acceptance/regression cases |
| --- | --- | --- |
| FR-01 Accounts | T03, T14 | TC-01 |
| FR-02 Saved account data | T04, T14 | TC-02 |
| FR-03 Host listings | T05, T13, T14 | TC-01, TC-03 |
| FR-04 Suggested host price | T08, T05 | TC-04 |
| FR-05 Map and catalog | T06, T09 | TC-03, TC-07 |
| FR-06 Area/connector search | T07, T09 | TC-07, TC-08 |
| FR-07 Total-cost optimization | T08, T09 | TC-05, TC-06, TC-08 |
| FR-08 Point-to-point route | T10, T12 | TC-09, TC-12 |
| FR-09 Charging-stop plan | T11, T12 | TC-10, TC-11, TC-12 |
| NFR-01 through NFR-06 | T02, T13-T17 across the core features | TC-01, TC-02, TC-07, TC-12, TC-13, TC-14 and manual release checks |

## Supporting quality requirements

| ID | Proposed release criterion |
| --- | --- |
| NFR-01 Data integrity | Validate at the server boundary; reject negative/non-finite money, nonpositive efficiency/capacity/power, invalid coordinates, invalid hours, and unsupported enum values. Store money/rates at documented decimal precision. |
| NFR-02 Access control | Verify session and ownership on every private read/write. Keep provider secrets server-side. Public responses omit private account data and whatever exact-address details the agreed privacy policy restricts. |
| NFR-03 Usability | Core workflows work at 375 px and 1280 px widths with keyboard input, labeled fields, visible focus, errors, loading states, and a usable list when maps fail. |
| NFR-04 Reliability | Database restarts do not erase saved state. Provider timeout/quota/no-route responses are handled without claiming an optimal or feasible result. |
| NFR-05 Performance | Proposed small-pilot targets: catalog API p95 under 2 seconds at 10 concurrent users; trip planning completes or times out with a clear message within 15 seconds. Measure on the chosen environment and record the dataset/provider assumptions. |
| NFR-06 Repeatability | A teammate can install from the lockfile, migrate/seed the database, run documented checks, and deploy the same release using configuration instructions. |

## Existing extras and deferred scope

Reservations, host approvals, earnings charts, reviews, payment selection, calendar export, and notification toggles exist in the demo but are not expressly required by proposal sections 1.1-1.4. They must not displace the four core feature areas.

For the first release, label or disable unsupported actions. If the team keeps booking as an operational feature, implement shared driver/host records, time-slot validation, authorization, and overlap prevention before calling it functional. See optional tasks X01-X03 in the [team plan](TEAM_PLAN.md).

Defer real payments/payouts, charger hardware control and metering, live network availability, verified-host claims, review submission/moderation, automatic notifications, native mobile apps, and national-scale optimization. These are additions to scope, not requirements silently satisfied by the demo screens.

## Decisions to make before implementation

Record the choices in [Architecture](ARCHITECTURE.md#decision-log) during the first iteration. These are planning questions for the team, not blockers to reading or using the guides.

| Decision | Proposed starting position | Owner |
| --- | --- | --- |
| Identities and database | One supported authentication integration and one relational database; choose products after checking compatibility and team access. | A, reviewed by B |
| Mapping services | Separate tile rendering, geocoding, road distance, and routing capabilities; choose providers and a quota budget. | B, reviewed by A |
| Public charger source | Import an attributed, reproducible regional dataset; record source date, license/terms, connector and price gaps. Unknown price is not zero. | B |
| Distance limit | Maximum one-way road distance; use round-trip road distance for travel cost. Label any straight-line fallback separately and exclude it from a road-optimized claim. | Both |
| Travel energy rate | Explicit USD/kWh assumption, initially configurable per search or profile; do not silently reuse a universal `0.32`. | Both |
| Host suggestion | Retain the demo rule as an initial heuristic, explain it as markup rather than margin, and use one implementation everywhere. | Both |
| Listing privacy | Decide which approximate location is public and when, if ever, exact home address is revealed; enforce this in API responses. | Both |
| Booking and photos | Defer real booking; use clearly identified sample/placeholder images until safe uploads are implemented. | Both |
| Delivery capacity | Replace the example eight-week cadence with actual availability and submission date. | Both |

## Proposal-complete demonstration

1. Host A signs in, enters an electricity rate, sees an explained price suggestion, and publishes a real-location listing.
2. Driver B opens a separate browser, finds that listing alongside public chargers, selects a vehicle/origin/energy request, and filters eligible results.
3. B compares itemized total costs. A fixed test case produces the expected lowest-cost charger consistently across screens.
4. B saves a favorite and vehicle, signs in elsewhere, and retrieves the same data.
5. B plans a real road trip. The map shows the route and reachable compatible stops, or explains that no feasible plan exists.
6. An unauthorized edit of A's listing is rejected. No screen implies that a real payment, hardware charging session, or verification occurred.
