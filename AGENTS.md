<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Repository guidance

Read [docs/README.md](docs/README.md) before using `docs/` for task context. It is the document router: load only the document for the task branch you are working on.

Source files, `package.json`, migrations, and tests are the source of truth for current behavior. The dated planning snapshots in `docs/` describe the October 24, 2026 baseline; verify a claim in the repository before implementing from one.

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues for `jindoridodi/charge-buddy`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo using root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.
