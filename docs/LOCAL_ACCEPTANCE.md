# Local acceptance and recovery record

This is a repeatable **local** checklist for the path in [ADR 0010](adr/0010-core-acceptance-path.md). It is not evidence of a completed release, a live nationwide import, or a tested backup. Work on the account, peer listing, quote, and trip paths is still being integrated; record failures and rerun this checklist on the final commit. Do not put credentials, private addresses, or account tokens in evidence.

## Prepare an isolated local run

1. Record `git rev-parse HEAD`, Node version, date, and the migration filenames. Use Node 24.12.0 and `npm ci`. Run `npm run typecheck`, `npm run test:unit`, `npm run build`, and `npm test`; run `npm run test:ui` after building when Chrome is available. Record command exit codes, not just screenshots.
2. Start Docker Desktop with Linux containers and run `npm run test:reports:db`. This creates a disposable offline PostgreSQL database, applies all migrations in filename order, seeds synthetic identities and catalog records, and exercises account isolation, peer publication/privacy, catalog, and price-report rules. It deletes that database afterward; it does not seed a usable browser account or prove Supabase Auth works.
3. For the browser path use a separate disposable Supabase project or local Supabase instance with Auth enabled, never a production database. Apply every file in `supabase/migrations` in filename order, exactly once, using the migration mechanism for that instance. Migration versions must be unique. The November 8 migrations are account revision `001`, account validation `002`, peer listings `003`, and quote ranking `004`; peer listings must precede quote ranking. If an earlier version of these files was already applied, stop and reconcile migration history and schema before proceeding; renaming files does not undo or rerun SQL.
4. Set the variables listed in `.env.example` in an untracked `.env.local`. Configure routing/geocoding as described in [infrastructure setup](../infra/README.md). The supplied routing extract is California only. Import the public catalog using [the NREL instructions](SUPABASE_SETUP.md), including the single-import coordination rule. Record import date, result, and source freshness. A synthetic import test is not a live import.
5. Create two disposable Auth accounts A and B through the configured sign-up flow. Use separate browser profiles. Create a vehicle and favorite as A and a distinctive peer listing as A; this is the browser seed. Record only non-sensitive fixture values and the approximate public location. Recreate the seed for a fresh database; the SQL test identities are not login credentials.

## Core path and evidence

For each item record pass/fail/blocked, commit, date, environment, and an anonymized observation or artifact. A blocked item is not a pass.

- Sign out and back in as A in a fresh profile; verify the saved vehicle and favorite persist. Sign in as B and verify A's private data is absent.
- Publish A's listing. From B's profile discover it alongside an attributed public charger; verify approximate location, price, connector and freshness/unknown labels. Pause it as A and verify it disappears from B's discovery, then republish it.
- With one origin, vehicle, energy amount and assumptions, compare eligible chargers and check the itemized totals and ordering across discovery, detail and comparison. Record the inputs and observed totals. Check an unknown price is not treated as free.
- Plan a route requiring a compatible charging stop. Record endpoints at city level, vehicle, start/reserve, objective, result, stop and stated bounds. Check route geometry and that each leg respects reserve; separately exercise no-plan or provider failure and verify it is not presented as a feasible plan.
- Attempt to change A's listing while authenticated as B and anonymously, through the server boundary. Record rejection and verify A's listing remains unchanged. Do not send real credentials or private addresses in the evidence.
- Check unsupported reservations, payments, verification, reviews, calendar and notifications are disabled or clearly identified as demo/deferred; record any misleading action as a blocker.

Repeat discovery in at least two U.S. regions, including outside California, and a long-distance trip with the corresponding routing/geocoding data loaded. Record cities, coverage, source date, and result. A California-only routing extract cannot establish national routing coverage. The automated Boston/national catalog and long-corridor trip fixtures are useful regressions, not evidence of real geographic/provider coverage.

## Recovery rehearsal

Before any migration on a database containing data worth keeping, stop writes and imports, record the running application commit and migration history, and take a provider-supported backup that includes the necessary database and Auth data. Store it securely outside the repository and record its recovery point. Confirm the chosen provider's actual backup and restore procedure and permissions for that instance; do not assume an application rollback reverses a migration.

Restore that backup into a **different disposable local instance** using the provider's supported procedure. Verify the restored migration history, sign in as a test account, check its vehicle/favorite and peer listing, verify public discovery, and rerun the core path above. Record backup time, restore time, recovered data and failures without secrets. Do not overwrite the only copy of useful data for a rehearsal. If recovery fails, keep the original intact and resolve the restore before release. A disposable SQL regression is not a backup/restore rehearsal.

If a release fails, stop writes/imports and exposure of the broken feature. Restore the previous application commit only if its compatibility with the current schema is verified; otherwise follow the tested migration recovery or restore procedure. Recheck account access, discovery, quote and trip before resuming use. Record the chosen recovery point and any lost changes.

## Current evidence

No browser acceptance, live provider coverage, performance measurement, or backup/restore has been performed by this checklist. Fill in an evidence record for the final integrated commit; retain failures and limitations alongside passes. See [Testing](TESTING.md) for the full requirement matrix and release gate.

On November 8, 2026, `npm run test:reports:db` passed on the issue-10 worktree based on `245ee8e` with the migration renames above. It used synthetic identities and data in a disposable offline PostgreSQL 17 container. This is pre-integration evidence and must be rerun on the final commit.
