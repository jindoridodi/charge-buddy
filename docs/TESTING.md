# Testing and release checklist

> **Current verification setup:** Updated October 28, 2026. The acceptance cases below remain proposed coverage, not evidence that the nationwide release is complete.

This document separates current automated checks from coverage still needed. Acceptance criteria are in [Requirements](REQUIREMENTS.md); release responsibilities are in [SDLC](SDLC.md).

## Commands that exist now

From the repository root, with Node.js 24.12.0 (the CI version):

```sh
npm ci
npm run typecheck
npm run test:unit
npm run build
npm test
```

Use `npm ci` for reproducible setup on a fresh checkout; it reinstalls dependencies from the lockfile. CI runs this sequence on Linux and Windows for pushes and pull requests, without backend credentials or live providers.

`npm run typecheck` generates Next.js route types before running TypeScript, so it also works before the first production build on a fresh checkout.

`npm run test:unit` runs catalog, Account-state, price-report, rate-limit, import, API, and trip-planner suites through Node's test runner and `tsx`. Run the original focused suites with `npm run test:catalog`, `test:account-state`, `test:reports`, `test:rate-limit`, or `test:trip`. API and import tests intercept only external HTTP calls with synthetic data; application logic is not mocked. The shared loader substitutes framework image imports and the `server-only` marker. These tests do not verify live providers or the complete browser acceptance path.

`npm test` runs only `scripts/smoke-test.mjs`. It needs a fresh production build, chooses an available local port, and stops its own server afterward, including on assertion failure. It checks 12 HTTP route responses plus CSS and the hero image. Do not describe it as browser, API persistence, or end-to-end coverage.

There is currently no `lint`, `test:integration`, or `test:e2e` script. Add the remaining coverage as the corresponding features are implemented.

### Price-report and catalog database regressions

With Docker running Linux containers, run `npm run test:reports:db`. The test uses a disposable PostgreSQL 17 container, applies every application migration, and exercises authenticated inserts with public-field returns, duplicate rejection (`23505`), distinct accounts/dates, ownership enforcement, and private reporter identities for authenticated and anonymous callers. Only the Auth helper functions and roles are fixtures; application tables, constraints, grants, and RLS use the real migrations. This is a database check, not a live Supabase Auth or HTTP integration test.

The same command verifies route-segment midpoint inclusion, corridor distance exclusion, national versus selected-origin searches, and filtering before pagination when more than 100 ineligible records precede a match. Planner regressions include carrying cheap energy past a station, and service tests verify that applied search and timeout bounds are disclosed.

The first run may download the pinned Supabase PostgreSQL image. The test container has no network access or persistent data mounts, mounts only migrations/tests read-only, and is removed after the test. Linux CI runs it alongside the focused suites; the Windows CI job does not provide Linux Docker containers.

### Windows sandbox account-lookup failure

In the restricted Windows agent sandbox, `tsx` may fail before collecting tests with `uv_os_get_passwd returned ENOMEM`. Confirm the cause with:

```sh
node -e "require('node:os').userInfo(); console.log('user lookup passed')"
```

On the affected machine, the same command and the focused tests pass in a normal PowerShell session outside the sandbox. Run `npm run test:unit` there, or allow the agent's test command to run outside the sandbox. Do not patch `node_modules`, spoof the account identity, or interpret this error as proof of application memory exhaustion. Changing to `node --import tsx` does not avoid the lookup. CI uses normal hosted runners and does not rely on a restricted Windows account lookup.

## Coverage to add

| Test layer | Meaningful checks | Lead |
| --- | --- | --- |
| Domain | Cost arithmetic, decimal rounding, invalid inputs, price suggestion, connector rules, route energy/reserve/capacity, deterministic ranking. | B |
| API/database | Sessions, own-versus-other-user reads/writes, persistence, catalog sanitization, migrations, unknown/deleted IDs, schedule validation. | A |
| Provider contracts | Geocode/routing normalization, coordinate order, road distances, timeout/quota/no-route/malformed response handling. Use fixtures in routine CI. | B |
| Browser | Host publishes, another account discovers; saved vehicle/favorite survives a separate browser; list/detail/compare agree; trip renders route/stops; logout clears private state. | B with A review |
| Manual release | Responsive layout, keyboard use, map failure fallback, real-provider smoke, setup/recovery, and proposal demonstration. | Both |

Mock external providers for deterministic regression tests. Run a small separately configured live-provider check before the final demonstration; record credentials/configuration names, response date, and limitations without logging secrets.

## Acceptance and regression cases

These are proposed tests, not results already obtained.

| Case | Requirements | Input or action | Expected result |
| --- | --- | --- | --- |
| TC-01 Account boundary | FR-01, FR-03, NFR-02 | Anonymous publish; invalid login; owner A edits; user B attempts the same edit. | Unauthorized actions fail; A's valid edit succeeds; client-supplied owner IDs do not grant access. |
| TC-02 Saved data | FR-02 | A saves vehicle/default/favorite; sign in as A in another browser, then as B. | A's data persists; B gets only B's data. Logout/account switching clears private cached data. |
| TC-03 Shared catalog | FR-03, FR-05 | A publishes a valid geocoded peer listing; B loads catalog; A pauses it. | B sees the record and correct source/location policy; paused record disappears from discovery. |
| TC-04 Host suggestion | FR-04 | Home rates `0.24` and `0.10` USD/kWh using the proposed heuristic. | Suggestions `0.34` and `0.15`; default submitted price matches the displayed suggestion unless overridden. Reject invalid/negative/non-finite rates. |
| TC-05 Cost breakdown | FR-07 | 30 kWh; rate `0.28`; fee `2.00`; round-trip road distance 8 mi; efficiency 4 mi/kWh; travel rate `0.32`. | Electricity `8.40`, payable `10.40`, travel `0.64`, comparison total `11.04` USD. Travel is excluded from any optional payment amount. |
| TC-06 Ranking objective | FR-06, FR-07 | Compare TC-05 against rate `0.25`, fee `3.00`, round-trip 20 mi with the same energy/vehicle/travel rate. | Competitor total is `12.10`; the `11.04` option ranks first despite its higher energy rate. Tie rules are deterministic. |
| TC-07 Eligibility/unknowns | FR-05, FR-06, FR-07 | Incompatible connector, paused/offline record, outside driving radius, unknown price/status. | Ineligible records do not win eligible cost ranking. Unknown values are labeled and not treated as free or guaranteed available. |
| TC-08 Shared quote | FR-07 | Use one origin/vehicle/energy selection in list, detail, and comparison; change origin and requested kWh. | Components use consistent inputs and totals; recalculated values change with the inputs. |
| TC-09 Road geometry | FR-08 | Two known endpoints with a fixture returning road geometry and asymmetric outbound/return distances. | Correct coordinate order/map line, road mileage, correct round-trip sum for discovery; endpoint text alone cannot define the result. |
| TC-10 Reserve boundary | FR-09 | Battery 60 kWh, efficiency 4 mi/kWh, start 30% = 18 kWh, reserve 10% = 6 kWh; first leg 48 mi, then 52 mi in a separate case. | 48-mi leg arrives with exactly 6 kWh and passes; 52-mi leg arrives with 5 kWh and fails without an earlier stop. |
| TC-11 Multi-leg energy | FR-09 | Arrive at a compatible stop with 6 kWh; next leg 64 mi at 4 mi/kWh; reserve 6 kWh. | Depart with at least 22 kWh, so add at least 16 kWh; never exceed capacity. At constant 7.2 kW, 16 kWh takes about 2.22 hours before other limits. Reject closed/unreachable stops. |
| TC-12 Failure and recovery | FR-08, FR-09, NFR-04 | No charging required; no feasible sequence; provider timeout; invalid geocode; database restart. | Correct distinct states; timeout is not reported as no feasible trip; no false feasibility claim; saved data survives restart. |
| TC-13 Data/privacy/UI | NFR-01, NFR-02, NFR-03 | Invalid values, restricted exact-address lookup, missing charger ID, keyboard navigation, narrow viewport, unavailable map tiles. | Server validation/access enforcement; detail API true 404; accessible controls; useful list/error fallback. |
| TC-14 Setup/performance | NFR-05, NFR-06 | Fresh database migration/seed; core endpoint load at agreed pilot capacity; staged restore. | Repeatable setup, recorded latency/timeout results, recovered data, and rerun acceptance checks. |

For optional reservations, add two simultaneous overlapping requests and require at most one active reservation; also test timezone/day boundaries, opening hours, cancellation/state transitions, energy versus power/duration, and a single consistent record in both dashboards. These checks are mandatory only if the release claims operational booking.

## CI to implement

1. Install the pinned Node version and dependencies with `npm ci`.
2. Generate required database/client artifacts and prepare a separate disposable test database.
3. Run type checking and the new domain/API checks using their actual documented scripts.
4. Build the application, then run the existing HTTP smoke suite.
5. Run the new core browser suite with deterministic provider fixtures and seeded test accounts.
6. Retain failing logs/screenshots without credentials or private addresses; require passing checks before merge/release.

Avoid making ordinary CI depend on live API quotas. Document any separate live-integration check and environment variables.

## Release checklist

- [ ] Every FR-01 through FR-09 acceptance criterion has current evidence linked from a task or release note.
- [ ] NFR validation, authorization/privacy, responsive/keyboard, failure, performance, and repeatability criteria are checked.
- [ ] All current automated checks pass on the release commit.
- [ ] A separate host and driver complete the demonstration using shared database records.
- [ ] Unknown prices/status, estimation assumptions, and data-source attribution are visible.
- [ ] Unsupported payments, bookings, verification claims, calendar and notification actions are disabled or clearly labeled.
- [ ] `.env.example`, migrations, seeds/imports, provider setup, and deployment instructions are accurate.
- [ ] Staging backup/restore and application/schema recovery steps have been exercised.
- [ ] Release commit, migration version, known limitations, and handover notes are recorded.

## Suggested final demonstration

Use fresh seeded accounts in isolated browser profiles. Show host sign-in -> price suggestion -> publish -> driver discovery -> connector/distance filter -> itemized comparison -> saved vehicle/favorite in another session -> routed trip with feasible stops -> rejected unauthorized edit. Include a no-plan or provider-failure example. Do not use a preselected localStorage state as evidence of shared persistence.
