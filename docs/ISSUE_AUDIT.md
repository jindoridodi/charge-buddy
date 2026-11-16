# ChargeBuddy issue audit — November 16, 2026

The UI is largely built, but the shared application is not release-complete. Much of the missing functionality already exists on the integration branch. An open issue can have substantial implementation without meeting its acceptance criteria. This audit does not close any GitHub issue.

Sources: Project_Proposal.pdf (two pages), live GitHub issue/PR descriptions and checks, main at `9066d2407c2c5ac4ed81957a2ed77829647a9243`, integration at `3abf6068a3a2ff3815f385f596d44142e4c7a081`, and the source/tests on those branches. The October planning documents are historical snapshots.

## GitHub status and remaining work

| Issue | Already on main | Additional implementation | What remains before closing |
| --- | --- | --- | --- |
| [#3 Verification/CI](https://github.com/jindoridodi/charge-buddy/issues/3) — CLOSED | Focused tests, typecheck, build, smoke and Linux/Windows CI exist. Main's 61 unit cases and typecheck passed locally. | Integration also includes the per-file completion guard. | Preserve these checks while integrating. Closed status does not establish end-to-end release readiness. |
| [#4 Account persistence](https://github.com/jindoridodi/charge-buddy/issues/4) — OPEN | Supabase email/password auth and session checks exist; private application data remains browser-oriented. | PR #12 and integration add account APIs, persisted vehicles/favorites/preferences, row security, revision checks, account switching and save handling. | Apply compatible migrations to a disposable environment, then prove sign-in/sign-out, cross-browser persistence and two-account isolation. Local completion branch removes the fake profile-save action that could fabricate a client account. |
| [#5 Nationwide discovery](https://github.com/jindoridodi/charge-buddy/issues/5) — OPEN | NREL normalization/import, catalog search/detail, source/freshness, unknown availability/prices, and public favorites exist. | PR #14/integration add scheduled national refresh, current importer endpoint and import coordination. | Merge reviewed changes; configure Actions secrets; demonstrate a successful live national refresh and searches/details across representative regions. A scheduled workflow on a feature branch is not evidence of an operating production refresh. |
| [#6 Peer listings](https://github.com/jindoridodi/charge-buddy/issues/6) — OPEN | Listing UI and local/demo state exist. | Integration adds authenticated create/edit/pause, owner checks, row security, public catalog projection and coarse locations. | Apply migrations; prove A publishes, B discovers, B cannot edit, private addresses stay out of public responses, and paused records disappear. Database regression scripts exist but were not run here. |
| [#7 Shared quotes](https://github.com/jindoridodi/charge-buddy/issues/7) — OPEN | Comparison still assumes 30 kWh and uses old local lookups; public catalog has authoritative price handling. | Integration adds shared origin/energy/vehicle inputs, public comparison and database cost ranking. The separate quote-review branch was unfinished. | Local completion branch finishes stale-origin clearing, partial comparison failures, removable unavailable selections and itemization. All 18 integrated browser cases passed, including the shared quote and map-fallback cases. Deployed database ranking still needs verification. Travel is explicitly a straight-line estimate, not a road-distance quote. |
| [#8 Nationwide trip evaluation](https://github.com/jindoridodi/charge-buddy/issues/8) — OPEN | Geocoding/routing adapters, bounded charger search, energy/connector/reserve rules, and distinct outcomes exist. | Integration supplies a nationwide extract configuration and national/disconnected-region fixtures. | Provision/load real nationwide routing and geocoding data and verify connected routes, including within Alaska and Hawaii. Fixture responses do not establish live coverage. Candidate detours remain disclosed corridor estimates. |
| [#9 Driver trip experience](https://github.com/jindoridodi/charge-buddy/issues/9) — OPEN | Route UI, stops, warnings and invalidation of stale requests exist. | `issue-9-trip-results` adds leg batteries/timing and map bounds; now incorporated in the local completion branch. The local repair retains evaluated battery precision for destination arrival. | The final integrated browser suite passed the synthetic mobile/keyboard trip case. A real provider-backed trip and coverage evidence remain. |
| [#10 Acceptance/recovery](https://github.com/jindoridodi/charge-buddy/issues/10) — OPEN | Historical testing/release guidance exists. | Integration adds a local acceptance/recovery checklist. Local completion clarifies deferred features and disables unsupported notification/unit/profile controls. | Perform the complete two-account acceptance workflow, regional/long-distance checks, fresh migration rehearsal, backup/restore and rollback rehearsal in an agreed disposable environment; record results. No staging/live recovery proof exists from this session. |
| [#13 Test-completion guard](https://github.com/jindoridodi/charge-buddy/issues/13) — OPEN | The old aggregate tsx invocation remains on main. | PR #15 and integration include per-file discovery, a timeout, final-summary validation, failure filenames and continue-after-failure regressions. | Review/merge the integrated runner and obtain fresh hosted CI. The guarded local run completed all 18 files with 80 passing cases. |
| [#2 Nationwide release](https://github.com/jindoridodi/charge-buddy/issues/2) — OPEN | Foundations only. | Integration combines most feature implementations. | The parent stays open until its child acceptance criteria and operational evidence are satisfied. |

## Existing pull requests

- [#1](https://github.com/jindoridodi/charge-buddy/pull/1): merged foundation for catalog, reports and trips.
- [#11](https://github.com/jindoridodi/charge-buddy/pull/11): closed without merging; closure is not completion. Account work continues in #12.
- [#12](https://github.com/jindoridodi/charge-buddy/pull/12), [#14](https://github.com/jindoridodi/charge-buddy/pull/14), [#15](https://github.com/jindoridodi/charge-buddy/pull/15): open with successful Linux/Windows checks at their own revisions. Integration contains these features and further repairs, so coordinate integration instead of independently merging overlapping implementations.
- [#16](https://github.com/jindoridodi/charge-buddy/pull/16): open integration checkpoint, mergeable, failing hosted CI. The inspected November 8 run reaches smoke testing and still expects the removed demo charger name on `/chargers/c1`. The local branch updates this and the obsolete listing-page expectation. Hosted CI has not run on the local repair.

## Local completion branch prepared in this session

Location: `/private/tmp/charge-buddy-completion-20261116`; branch: `release-completion`.

It begins at the existing integration checkpoint, incorporates `issue-9-trip-results` and `quote-review-fixes`, and resolves their browser-test merge conflict while retaining both sets of regressions. Further repairs:

- Clear old quote origins when a new URL location fails; prevent catalog requests from using that failed search.
- Fetch comparison items independently, retain successful items, and let users remove/retry unavailable selections. Use the public projection consistently, including hosts' own listings.
- Show electricity, host fee and travel components alongside the shared total.
- Retain evaluated battery percentages rather than reconstructing destination charge from rounded stop percentages; suppress floating-point display noise.
- Identify Peer detail pages as host-reported data with approximate locations, rather than incorrectly attributing them to NREL.
- Replace simulated home-page geolocation with browser geolocation and an actionable manual-location fallback.
- Remove the profile-save path that synthesized a client identity; disable unsupported notifications and distance conversion; label demo booking/earnings and deferred functionality.
- Repair clean-install lockfile consistency. Update Next.js to 16.4.6 and Zod to 4.6.7 after the build/advisory check identified affected versions. Use Zod's documented `guid()` validator to preserve existing database UUID-format compatibility.
- Add quote arithmetic, fractional battery, anonymous-profile and geolocation regressions; repair obsolete smoke expectations and browser navigation selectors.

No code was pushed, no GitHub PR was merged, no issue was closed, no database migration/import was run, and no production environment was changed.

## Verification and limits

- Main baseline: typecheck passed; 61 unit cases passed.
- Local completion: typecheck passed after dependency updates; guarded unit suite passed all 18 top-level files, 80 cases; diff whitespace check passed. `npm ci --ignore-scripts --no-audit --no-fund --dry-run` also passed, verifying lockfile consistency without reinstalling or running install hooks.
- Production build: `NEXT_PUBLIC_SUPABASE_URL=https://catalog-test.invalid NEXT_PUBLIC_SUPABASE_ANON_KEY=browser-test-key npm run build -- --webpack` passed with Next.js 16.4.6. These are synthetic test values, not live credentials.
- The default Turbopack build was blocked by a local CSS compiler port-binding restriction, including an escalated attempt. The supported webpack build passed; this does not establish that the default build passed in this environment. Hosted default-build CI is pending.
- After correcting the obsolete navigation selector and using the same public test configuration as CI, the final integrated browser run passed all 19 cases. This includes price refresh, cross-view quote consistency, failed-location recovery, removable unavailable comparisons, mobile/keyboard trip outcomes, anonymous-profile protection, browser geolocation and honest Peer source attribution. HTTP smoke passed all 12 route checks plus stylesheet and image requests. These browser cases use intercepted synthetic API responses; they do not prove live Supabase or provider behavior.
- Docker and PostgreSQL tools are absent. Database/RLS regression scripts, live Auth, cross-browser account isolation, live national imports/provider coverage, and backup/restore were not exercised.
- Initial dependency advisory lookup identified Next.js GHSA-mfr8-8qww-v76h and Zod GHSA-mrhx-c7xc-m3w5. Installed versions were updated beyond the reported affected ranges. The final post-update `npm audit` completed successfully with zero reported vulnerabilities. This is a registry advisory check, not proof that all code is free of security defects.

## Environment handoff

The original checkout has `.env.example` but no `.env`, `.env.local`, `.env.development` or `.env.development.local`. This does not prove the team lacks a configured database; another machine or hosting provider may already have the configuration.

Ask the teammate for the **development** Supabase project URL and publishable/anon key, confirmation of the applied migration versions, Auth confirmation/redirect configuration, and the intended routing/geocoding endpoints. Ask for the NREL and Supabase service-role credentials only if running imports is part of the local setup. Share secrets privately, put local values in ignored `.env.local`, and never expose a service-role key under a `NEXT_PUBLIC_` variable.

Existing code reads `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NREL_API_KEY`, `VALHALLA_URL`, and `NOMINATIM_URL`. A database connection alone does not provision routing/geocoding or prove that all branch migrations are installed. Do not apply new migrations to the teammate's only useful database without reconciling its migration history and recovery plan.

## Recommended completion order

1. Review this local integration branch and run the default build on hosted CI; local browser/smoke checks passed. Obtain fresh Linux/Windows CI on the reviewed revision.
2. Agree on a disposable Supabase/local environment; reconcile migrations and configure Auth. Prove #4 and #6 through two real test accounts.
3. Enable/verify national catalog refresh and real regional discovery (#5).
4. Verify shared quote/ranking behavior against that database (#7), then provision and exercise nationwide routing/geocoding and trip results (#8/#9).
5. Record the complete acceptance path and recovery rehearsal (#10); close children and then parent #2 only against evidence.

## Proposal scope

Proposal 1.1: peer charger sharing/listing is implemented on the integration branch; actual reservations, payments and payouts are deferred by the repository's core-release decision. Proposal 1.2: origin-aware charging/travel estimates and filters are implemented but deployed ranking evidence is pending; the final cross-view browser regression passed. Proposal 1.3: map and bounded routing foundation exists; live geographic coverage is pending; the final fixture-based trip UI browser checks passed. Proposal 1.4: real auth exists and durable account data is implemented off main; cross-browser and cross-account live verification is pending. If the course requires actual rental transactions, the current core issue scope does not implement those transactions.
