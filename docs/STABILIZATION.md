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

Product-code revision reviewed: `901e8c9abe3d85be2b995cff66abd9e8b5c8cbaf`. The closing documentation-only commit records these results without changing executable code.

Local checks passed: 61 focused tests, seven browser regressions, disposable PostgreSQL privacy/moderation/catalog checks, typechecking, production build, and 12-route smoke checks plus CSS/image checks. S01/S02 were reproduced red before their fixes and then passed their focused regressions.

| Review | Standards axis | Spec axis | Disposition |
| --- | --- | --- | --- |
| Repair diff `d22d415...901e8c9` | 0 findings | 0 findings | No introduced stabilization regressions, blockers, or new follow-ups identified. |
| Final branch diff `cc55193...901e8c9` | 0 findings | 1 P2 finding, F01 below | Existing branch defect; nonblocking follow-up for the foundation PR. No new stabilization regressions or merge-blocking code findings identified. |

### Follow-up F01: local demo quote origin consistency

- **Origin:** existing at `d22d415`, verified against that commit; not introduced by this stabilization pass.
- **Location:** `src/components/ChargerCard.tsx:38`; connected callers `src/views/compare.tsx:15` and `src/views/chargers.$id.tsx:83`.
- **Behavior:** discovery passes its selected origin into local demo listing costs, while detail/comparison use the default San Jose origin. The reviewer's synthetic check at `mine-1` produced $10.40 versus $10.68 for the same 30 kWh and vehicle.
- **Disposition:** P2, nonblocking follow-up for this foundation PR because the affected discovery listings are explicitly labeled local demo data. This does not change authoritative public-catalog pricing or trip calculations. It must be resolved as part of the shared quote contract before nationwide core acceptance.
- **Remedy:** carry the chosen quote origin into detail/comparison and add a cross-view regression at the shared quote/browser boundary. No external issue was opened in this pass.

### Merge-readiness assessment

**The foundation PR is ready to push for CI, but not yet ready to merge.** There are no code blockers identified by the two scheduled reviews; F01 is explicitly deferred. Required next gate: push the completed branch and verify hosted Linux/Windows checks on the actual proposed merge HEAD, including this documentation-only closure. Existing successful checks cover remote `c30db13`, not these local commits. Remote main was verified at `cc55193`.

This bounded pass is closed: both selected fixes are committed, both scheduled reviews completed, and every resulting finding has a disposition. No additional whole-branch review loop is required by this pass. A changed merge base, new code, a failing check, or a newly demonstrated blocker would justify reopening the relevant checks. Nationwide release readiness remains separate and unproven.

## Known limits and follow-ups

- Import pagination is not a database transaction or a provider snapshot. A failed import may have upserted earlier valid pages; it must not deactivate unseen stations. Retry a failed import after resolving its source/data error. Concurrent import jobs and same-count provider changes need an operational single-run policy or future snapshot/staging design before overlapping production imports are supported.
- Live national provider coverage, staging acceptance, recovery evidence, Account persistence, and shared Peer listing lifecycle remain release work outside this stabilization scope.
- No push, merge, remote import, or remote migration is part of this pass. Hosted CI at the final local revision must be verified before merging.
