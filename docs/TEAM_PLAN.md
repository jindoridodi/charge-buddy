# Two-person delivery plan

> **Planning snapshot:** Tasks and estimates describe the October 24, 2026 baseline; they are not current status. Consult [the documentation router](README.md) and verify the repository before scheduling work.

This plan turns the gaps in [Current state](CURRENT_STATE.md) into work that satisfies [Requirements](REQUIREMENTS.md). For the execution sequence, use [Step-by-step completion guide](IMPLEMENTATION_STEPS.md).

## Responsibilities

Assign names at kickoff; these roles are proposed and can be swapped.

| Area | Developer A | Developer B |
| --- | --- | --- |
| Primary ownership | Database/migrations, auth, account data, host publishing, authorization, deployment. | Domain costs, discovery/comparison, mapping providers, route planning, map integration. |
| Tests | Account/listing API and database integration; cross-user access. | Numerical/route tests and core browser flows. |
| Shared work | Agree contracts, review B's changes, integrate features, maintain docs, demonstrate release. | Agree contracts, review A's changes, integrate features, maintain docs, demonstrate release. |

These are subsystem leads, not a handoff between isolated frontend and backend teams. Each developer finishes their feature through the API/UI boundary. A and B review one another's code and both can run migrations, checks, and deployment.

Avoid concurrent edits to `src/lib/store.tsx`, `src/lib/data.ts`, and shared contracts. Name one owner for each change, use small branches, and integrate often. B can build against agreed deterministic responses while A implements storage; replace stubs before declaring completion.

## Prioritized remaining work

All tasks below are initially **not started**. Effort is rough total person-hours, including implementation and focused verification; pair time counts for both people. Re-estimate after the first integrated workflow. "Done" means evidence exists in addition to a merged implementation.

| ID | Work and completion evidence | Lead | Depends on | Hours |
| --- | --- | --- | --- | --- |
| T01 | Confirm scope/roles; run baseline; record ADR-01 through ADR-05 choices and release exclusions. | Both | None | 4 |
| T02 | Agree types/API shapes; create migrations, relational constraints, configuration example, and reproducible regional seeds. Fresh database setup works. | A | T01 | 8 |
| T03 | Integrate real identity/session lifecycle; reject anonymous writes; wire existing auth UI. Demonstrate invalid login and logout. | A | T02 | 8 |
| T04 | Persist profile, vehicles, favorites, supported preferences, and default vehicle. Verify two browsers and account isolation. | A | T03 | 8 |
| T05 | Persist validated host listings, owner edits/pause, consistent price suggestion, and geocoded locations. Second browser discovers the listing. | A | T03, T07 adapter, T08 | 10 |
| T06 | Import attributed public records; expose sanitized paginated catalog/detail with source/freshness and unknown-data handling. | A | T02 | 8 |
| T07 | Implement geocoding and road-distance adapter; actual search origin and one-way radius. Verify timeout/invalid-origin handling. | B | T02 contracts | 10 |
| T08 | Extract shared validation, compatibility, cost breakdown, and host-price rules. Pass hand-calculated domain cases. | B | T01, T02 contracts | 6 |
| T09 | Integrate eligible search/ranking, map/list selection, itemized detail and comparison using one quote contract. | B | T04, T06, T07, T08 | 10 |
| T10 | Add road-route adapter with geometry/distance normalization, bounded requests, and deterministic failure fixtures. | B | T07 | 6 |
| T11 | Implement bounded feasible stop planning, reserve/capacity/detour constraints, costs and no-plan result. | B | T06, T08, T10 | 14 |
| T12 | Replace trip slider demo with endpoint routing; render route/stops/battery information and meaningful failures. | B | T11 | 8 |
| T13 | Enforce location disclosure policy, private cache clearing, supported settings, validation UX; label/disable demo extras and unsupported marketing claims. | A | T04, T05, T06 | 6 |
| T14 | Add account/listing/database integration checks, unauthenticated and cross-user rejection, persistence, and true detail 404 checks. | A | T04, T05, T06 | 8 |
| T15 | Add cost and trip regression fixtures plus core browser workflows; verify requirements on mobile and desktop widths. | B | T09, T12, T13 | 8 |
| T16 | Add CI and deploy setup; test migrate/seed/build/check sequence, staging configuration, backup/restore and rollback instructions. | A | T14; release gate also needs T15 | 8 |
| T17 | Joint proposal acceptance demo, fix release blockers, record evidence and limitations, update all guides. | Both | T15, T16 | 6 |

Core estimate: **136 person-hours** before contingency. Provider integration and routing are the largest uncertainties. These numbers are planning assumptions, not a delivery guarantee.

Optional work starts only after all FR items meet acceptance:

| ID | Optional extension | Lead | Dependency and acceptance |
| --- | --- | --- | --- |
| X01 | Shared reservations and host decisions. | A | Core complete; one record drives both views; server checks hours, timezone, compatibility, energy/time, ownership, transitions, and concurrent overlap. No real payment. |
| X02 | Real listing photos. | A | Core complete; authorized uploads with size/type limits, storage access rules, and cleanup. |
| X03 | Calendar export, notifications, review submission, richer host analytics. | B | Core complete and explicit extension scope; implement each advertised action or keep it visibly unavailable. |

Payment processing and charger hardware integration need their own later project scope; do not infer them from the current reservation UI.

## Suggested cadence

The proposal gives no deadline. This example assumes eight weeks at approximately 12 hours per person per week: 192 person-hours. The 136-hour core leaves roughly 56 hours for discovery, integration surprises, and corrections. Shift dates/capacity at kickoff; spend contingency on core completion before optional features.

| Week | A's focus | B's focus | Joint exit milestone |
| --- | --- | --- | --- |
| 1 | T01-T02 foundations and schema. | T01 contracts, T08 rules/fixtures; begin provider spike. | Scope, contracts, seeds, and numeric examples agreed. |
| 2 | T03 and start T04. | T07 and start T10. | Verified account plus real origin/road-distance proof. |
| 3 | Finish T04, T06, begin T05. | T09 catalog/quotes integration. | Saved vehicle/favorite across browsers; public catalog/search. |
| 4 | Finish T05 and start T13. | Finish T09 and T10. | Host-to-driver shared listing; consistent itemized costs. |
| 5 | T14 integration/access checks; finish T13. | T11 stop-feasibility service. | Core data/access checks pass; deterministic feasible trips. |
| 6 | T16 CI/deployment setup and integration support. | T12 route map and trip UI. | First complete proposal workflow in staging. |
| 7 | Release hardening, backup/restore exercise. | T15 regression/browser coverage. | Full acceptance pass and no release blockers. |
| 8 | T17 fixes, final docs, release preparation. | T17 fixes, final demo and evaluation. | Reproducible submission/release and handover. |

Dependency path: contracts/schema -> identity/persistence/catalog -> origin/quotes -> trip feasibility -> integrated tests -> release. Start the geocoding/routing spike early so provider access does not become a late surprise.

## Daily and weekly working agreement

- Start work with a short update: completed task, next task, blocker. Use one shared board with Ready, In progress, Review, and Done.
- Limit each person to one main implementation task. Make review the next priority when the teammate is waiting.
- Every task has a requirement ID, owner, acceptance evidence, and reviewer. Review behavior, authorization, units, and failures as well as code style.
- Twice a week, run the newest integrated host-to-driver flow together. Weekly, update the backlog and compare progress with exit milestones.
- If a task exceeds its estimate by half, pair on the blocker or split a small spike; re-plan openly instead of carrying unfinished work silently.

## Scope and risk responses

| Risk | Response and owner |
| --- | --- |
| Provider access, quotas, or unfamiliar APIs | B proves two geocodes, a road-distance request, and route geometry early; keep deterministic test fixtures and make failures explicit. |
| Routing takes longer than expected | B narrows region/candidate/stop bounds with documented limits; preserve feasible route planning as core scope. Cut optional screens first. |
| Auth integration or ownership errors | A uses supported session tooling, validates every private boundary, and adds two-user rejection checks before release. |
| Inconsistent totals/units | B owns one cost service and numerical fixtures; A reuses it when saving any optional booking quote. |
| Shared-file conflicts | Name a change owner and merge contract changes before dependent work. |
| Time shortage | Defer X01-X03, live feeds, uploads, and cosmetic work; retain all proposal requirements and report any unmet criterion honestly. |
