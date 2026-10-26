# Software development life cycle

Use an iterative SDLC: requirements -> design -> implementation -> verification -> deployment -> maintenance. Work in small vertical features inside these phases, with a working integrated demo each week. The [team plan](TEAM_PLAN.md) supplies owners and sequencing; [implementation steps](IMPLEMENTATION_STEPS.md) supplies the concrete work order.

## Phase 1: Planning and feasibility

**Goal:** agree on what two people can deliver and expose integration risks early.

1. Read the proposal and [current-state inventory](CURRENT_STATE.md).
2. Assign A/B, actual availability, submission date, region, and excluded extensions.
3. Run the existing baseline and create the shared task board.
4. Spike identity/database connectivity, two geocodes, a road-distance request, and route geometry before committing to integrations.
5. Estimate core work and preserve contingency. Record access/quota and routing risks.

**Deliverables:** team capacity, prioritized board, feasibility notes, selected integration options, risk responses.

**Exit gate:** both developers can run the project and explain what is demo behavior; required external capabilities have a working proof or a recorded unresolved dependency. Do not describe unresolved integrations as complete.

## Phase 2: Requirements analysis

**Goal:** turn product ideas into verifiable outcomes.

1. Review FR-01 through FR-09 and NFR-01 through NFR-06 in [Requirements](REQUIREMENTS.md).
2. Agree on units, cost assumptions, connector compatibility, distance semantics, location privacy, and availability limitations.
3. Attach requirement IDs and acceptance cases to every core task.
4. Treat bookings, payments, photos, and notifications as explicit scope decisions.

**Deliverables:** agreed acceptance checklist, release exclusions, and requirement-to-task mapping.

**Exit gate:** every required outcome has an owner and observable pass condition. Unresolved product choices are logged with an owner and due iteration.

## Phase 3: System and data design

**Goal:** make parallel work integrate reliably.

1. Read the installed Next.js guides required by `AGENTS.md` before implementation.
2. Agree on the schema, ownership model, API payloads/errors, provider interfaces, and client/server boundaries in [Architecture](ARCHITECTURE.md).
3. Record ADR-01 through ADR-05 with tradeoffs and consequences.
4. Design public versus private response fields and prevent client-authoritative ownership/pricing.
5. Write hand-calculated cost cases and battery-feasibility examples before implementing the rules.

**Deliverables:** schema/migration plan, contracts, ADRs, fixture examples, privacy/access rules.

**Exit gate:** A and B can implement against the same types and examples without guessing. The first migration and deterministic seed can be reviewed.

## Phase 4: Implementation and integration

**Goal:** deliver complete workflows in small changes.

1. Complete foundations, then account persistence, then shared host-to-driver discovery.
2. Replace fixture-based search/cost assumptions; implement road routing and feasible stops.
3. Add loading, empty, error, signed-out, and forbidden states with each feature.
4. Add focused tests for domain rules, access boundaries, and critical integrations as they are built.
5. Keep documentation and configuration examples current in the same change.

**Deliverables:** reviewed feature changes, migrations, tests, updated guides, and an integrated demonstration.

**Exit gate per feature:** its acceptance case passes through the real data boundary; dependent UI uses it; no hidden stub is counted as implementation.

### Development workflow

Use short branches such as `codex/t05-host-listings`. Keep changes small enough for the other teammate to review. A change description should explain the trigger, resulting behavior, requirement/task ID, relevant evidence, and migration/configuration implications.

The reviewer checks session/ownership enforcement, data exposure, input limits, coordinate/unit consistency, cost rules, failure states, and whether the documentation matches. Resolve review findings before merging. Do not require elaborate ceremonies for a two-person team; preserve the review and evidence.

**Definition of ready:** task has an owner, requirement, acceptance example, dependencies, known contract, and bounded scope.

**Definition of done:** implementation is reviewed; relevant checks pass; no required path depends on demo data; migrations/configuration are repeatable; supported UI states work; documentation and acceptance evidence are updated. A screen being present is insufficient.

## Phase 5: Verification and validation

**Goal:** prove that the implementation meets the proposal and handles meaningful failures.

1. Run the current typecheck/build/smoke suite.
2. Run domain checks for cost, host pricing, compatibility, and feasible/infeasible battery cases.
3. Run API/database checks for persistence, validation, ownership, and privacy.
4. Run browser workflows with separate host/driver accounts and isolated browser storage.
5. Exercise provider timeouts, unknown prices, empty results, and a no-feasible-plan trip.
6. Run the proposal demonstration and the responsive/keyboard checks in [Testing](TESTING.md).

**Deliverables:** requirement evidence, test results, defects, and documented limitations.

**Exit gate:** all FR acceptance cases pass, critical access/data/cost/routing defects are fixed, and any remaining limitations are explicit. Passing the existing HTTP smoke suite alone does not meet this gate.

## Phase 6: Deployment and release

**Goal:** deliver a reproducible version with recovery instructions.

1. Select a server-capable environment and isolate development, test, and deployed configuration/data.
2. Install from the lockfile; run migrations and deterministic seed/import on a fresh non-production environment.
3. Configure identity redirects, database connection, provider credentials, allowed public fields, and timeouts. Keep secrets outside source control.
4. Run automated checks in CI, then the acceptance flow against staging.
5. Back up data before applying a release migration. Prefer additive schema changes so the prior application version can still run during recovery.
6. Record the release commit, migration version, configuration names, verification evidence, and known limitations. Deploy that reviewed version.
7. Check account lifecycle, catalog, quote, trip, and logs immediately after deployment.

**Deliverables:** deployed release, release notes, migration/seed instructions, configuration example, backup and recovery runbook.

**Exit gate:** both teammates can identify the running version, reproduce setup, and carry out recovery in staging. No actual deployment is performed by these planning documents.

### Recovery outline

If release checks fail, stop exposing the broken feature and redeploy the previous compatible application version. Check whether the database schema remains backward compatible; application rollback does not undo a migration. For incompatible changes, follow the migration's tested recovery procedure or restore a verified backup with a stated recovery point. Re-run health and core workflow checks before reopening the release.

## Phase 7: Operation and maintenance

**Goal:** keep the release useful and correct after submission/deployment.

| Activity | Owner and cadence |
| --- | --- |
| Inspect errors, failed sign-ins/mutations, provider failures and quota usage. | A checks application/data issues; B checks map/trip issues after releases and during active pilot use. |
| Track public-source freshness and pricing/status uncertainty. | B reviews at each import and before demonstrations. |
| Review defects and new requests against scope. | Both weekly during active development; classify impact and assign the next action. |
| Back up and rehearse restore. | A documents the chosen backup schedule and tests restore before the first release and material schema changes. |
| Review dependency/integration updates. | Rotate lead; check installed guidance, test in a branch, and avoid unverified upgrades immediately before a deadline. |
| Refresh requirements, current state, test evidence, and handover notes. | Change author updates relevant docs in the same feature/release. |

For handover, retain architecture decisions, setup and recovery commands, migration history, provider/source attribution, known issues, release evidence, and a short demo script. Share credentials through the team's chosen secret-management method, never through these Markdown documents.

## Change control and defect handling

A new request becomes a task with rationale, impact, estimate, requirement links, and an explicit tradeoff against the remaining capacity. Both teammates agree whether it enters the current release. Do not add optional features merely because a demo control already exists.

Treat private-data exposure, unauthorized changes, incorrect core totals, and infeasible routes presented as feasible as release blockers. Reproduce each defect, add a focused regression case where useful, fix it, have the teammate review it, and record the verified result. Cosmetic issues can be deferred with a clear owner when they do not prevent acceptance.
