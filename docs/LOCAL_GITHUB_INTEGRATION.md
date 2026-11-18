# Local GitHub integration — November 17, 2026

All current GitHub branches, tags (if any), and all six open/closed PR heads have been fetched into this local repository. The active working branch is `release-completion`. Database-backed listing and reservation changes are integrated locally and verified; see [verification record](SHARED_LISTINGS_RESERVATIONS.md). Nothing was pushed to GitHub.

| Local reference | Revision | Included in integration history |
| --- | --- | --- |
| `origin` | `9066d2407c` | Yes |
| `origin/codex/issue-13-unit-test-completion` | `e7400db683` | See note below |
| `origin/codex/issue-4-account-persistence` | `e9019ec6f5` | Yes |
| `origin/codex/issue-5-nationwide-discovery` | `34d20dbb7c` | Yes |
| `origin/issue-9-trip-results` | `87fd5f279b` | Yes |
| `origin/main` | `9066d2407c` | Yes |
| `origin/pr/1` | `3e0539e519` | Yes |
| `origin/pr/11` | `30b30d3285` | Yes |
| `origin/pr/12` | `e9019ec6f5` | Yes |
| `origin/pr/14` | `34d20dbb7c` | Yes |
| `origin/pr/15` | `e7400db683` | See note below |
| `origin/pr/16` | `3abf6068a3` | Yes |
| `origin/quote-review-fixes` | `c803076331` | Yes |
| `origin/spec-2-integration` | `3abf6068a3` | Yes |

PR #15 (`e7400db`) is superseded by the integration branch’s test runner and later warning-handling regression. Its older implementation incorrectly treats a completed stdout summary followed by a stderr warning as incomplete. The integrated version preserves the PR’s feature plus that repair; reverting to the PR head would remove the repair. All its versions remain available locally under `origin/pr/15`.

The other feature branches and PR heads are ancestors of the integration branch. The old PR #11 is preserved separately from PR #12 even though both used the same branch name. Use `git log --all --oneline --decorate` or `git show origin/pr/NUMBER` to inspect historical versions.

Runbook signature scan: 275 unique tracked file blobs across the fetched references, 0 known marker hits. This is a signature scan, not a guarantee against all malicious code.
