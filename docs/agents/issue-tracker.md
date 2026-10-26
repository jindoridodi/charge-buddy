# Issue tracker: GitHub

Issues and specs for this repo live as GitHub Issues in `jindoridodi/charge-buddy`. Use the `gh` CLI for issue operations.

## Conventions

- Create: `gh issue create --title "..." --body "..."`
- Read: `gh issue view <number> --json number,title,body,labels,comments`
- List: `gh issue list --state open`
- Comment: `gh issue comment <number> --body "..."`
- Labels: `gh issue edit <number> --add-label "..."`
- Close: `gh issue close <number>`

Infer the repository from the GitHub remote. Pull requests are not a triage request surface for this repo.

## When a skill says publish to the issue tracker

Create a GitHub issue.
