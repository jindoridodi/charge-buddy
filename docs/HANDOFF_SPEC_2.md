# Nationwide core release handoff

Checkpoint: November 8, 2026. The integration branch is a draft toward [spec #2](https://github.com/jindoridodi/charge-buddy/issues/2), not a completed release. Read the issue and its dependent tickets for acceptance criteria. The owner runs locally and has no separate staging environment.

## Published work

- `spec-2-integration` contains the integration checkpoint through `67e4019`, plus this handoff. Its history includes Account persistence, Peer listings, national import configuration, quote ranking, trip-provider configuration, the unit runner and a local acceptance runbook.
- [`issue-9-trip-results`](https://github.com/jindoridodi/charge-buddy/tree/issue-9-trip-results) at `87fd5f2` contains the unmerged trip-results implementation. Review destination battery estimates that use rounded departure percentage. Verify map bounds and the map-unavailable message; the message was added after the last browser/build checks.
- [`quote-review-fixes`](https://github.com/jindoridodi/charge-buddy/tree/quote-review-fixes) at `c803076` is **unfinished**. It contains an API validation fix and regression tests. Complete the stale-origin and unavailable-comparison UI fixes; the new browser tests fail against the current UI, and the location test selector may need adjustment. Merge the current integration tip before completing this branch.

## Continue

1. Review, finish and integrate both published branches. Resolve any conflicts, including migration filenames, against the current integration tip.
2. Run the integrated unit, database, browser, typecheck and build checks. The latest complete unit run passed after the runner changes; feature branches also reported focused passing tests, but no final integrated run has been recorded.
3. Review the integrated changes against spec #2 and repository standards, and resolve findings. Keep issues open until their acceptance criteria are met.
4. Follow [local acceptance and recovery](LOCAL_ACCEPTANCE.md). Real nationwide provider coverage, the cross-account release path and an actual backup/restore have not been demonstrated. Record what is tested locally and any remaining limitations; do not represent fixtures as live evidence.

PRs [#12](https://github.com/jindoridodi/charge-buddy/pull/12), [#14](https://github.com/jindoridodi/charge-buddy/pull/14), and [#15](https://github.com/jindoridodi/charge-buddy/pull/15) remain open by owner request. Their review fixes are included in the integration branch rather than their original branches. The owner requested branch names without a `codex/` prefix.
