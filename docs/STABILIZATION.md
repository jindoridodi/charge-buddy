# Bounded stabilization ledger

Baseline: `d22d415259a0dc00fe8bb49e892c2a345dbf050d` on `EV-Trip-Planner`. Scope: PR #1's catalog, price-report, provider, and trip foundation; this is not nationwide release acceptance.

## Scope and stopping point

Fix the two known findings below, review the repair diff against `d22d415`, then perform one final branch review against `origin/main`. Record new findings with their origin and merge impact. A newly discovered issue in code already present at `d22d415` is an existing branch defect, not a regression introduced by this pass. Do not restart a whole-branch review after every finding.

Merge blockers include reproducible private-data exposure, unauthorized writes, destructive catalog reconciliation, incorrect core totals, or infeasible routes presented as feasible. Targeted regression checks and hosted CI must pass at the proposed merge revision. Other findings require an explicit follow-up disposition rather than an implicit requirement for zero conceivable bugs.

## Known findings

| ID | Finding | Origin | Status and evidence |
| --- | --- | --- | --- |
| S01 | Incomplete NREL pages can deactivate valid catalog records. | Existing at baseline; P2, merge blocker because reconciliation changes durable catalog visibility. | Fixed in this pass. Real-process regression reproduced 1,001 incorrect deactivations, then verified zero deactivations for missing metadata/records, mismatched totals/offsets, duplicate IDs, and invalid rows. Valid one-page/multi-page imports still reconcile 1,001 stale records. |
| S02 | Catalog dependency prevents a no-charge trip during catalog failure. | Existing at baseline; P2 availability defect selected for this pass. | Fixed in this pass. Both objectives return a feasible no-stop result with no configured catalog or catalog HTTP calls; charge-required failure coverage remains in place. |

## Previously resolved findings

These are tracked as resolved work, not rediscovered open findings. This table summarizes the earlier review groups; commits and tests hold their implementation details.

| Review group | Resolution |
| --- | --- |
| Report insertion and reporter privacy | `90f8c86` |
| Catalog/importer/planner correctness and explicit search bounds | `d434f3a`, `350ac2b` |
| Concurrent flags, detail outage recovery, refreshed authoritative UI prices | `2eafb42` |
| Administrator removal/restoration without wider reporter access | `0f7af4c` |
| Malformed trip/report JSON handling | `0a65c25`, `f21ba2c` |
| Body limits, routing response validation, fastest charging choices, discovery price cap | `90b954d` |
| Stale trip results and pending-response cancellation | `2013fdf` |
| Authoritative detail prices independent of capped report history | `d22d415` |

## Verification and review results

Local checks passed: 61 focused tests, seven browser regressions, disposable PostgreSQL privacy/moderation/catalog checks, typechecking, production build, and 12-route smoke checks plus CSS/image checks. The two scheduled reviews are pending; their pinned revisions and dispositions will be recorded before the pass closes.

Remote PR #1 currently points to `c30db13`; its successful Linux/Windows checks do not cover these newer local commits. Remote main was verified at `cc55193`.

## Known limits and follow-ups

- Import pagination is not a database transaction or a provider snapshot. A failed import may have upserted earlier valid pages; it must not deactivate unseen stations. Retry a failed import after resolving its source/data error. Concurrent import jobs and same-count provider changes need an operational single-run policy or future snapshot/staging design before overlapping production imports are supported.
- Live national provider coverage, staging acceptance, recovery evidence, Account persistence, and shared Peer listing lifecycle remain release work outside this stabilization scope.
- No push, merge, remote import, or remote migration is part of this pass. Hosted CI at the final local revision must be verified before merging.
