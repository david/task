# Local rules for `/skill:check`

## Local gates

Use the exact commands listed in `doc/task-workflow.md` under `## Repo verification commands`, then run:

```text
/skill:global-review --branch
```

## Local issue-backed context

When an issue is in play, read durable context from:
- `tasks/`
- `task-status/`
- `code-history/`
- `check-report/`

Use `bun task.ts get` and `bun task.ts show --id <id> --include-keys`.

## Local reports

- Append full reports under `check-report/run-00N`.
- Refresh the pointer at `check-report/latest`.
- Even passing runs must write both documents.

## Local handoffs

- passing issue-backed run => `Next: /skill:qa <id>`
- failing issue-backed run with clear repair slices => `Next: /skill:taskify <id> --from check`
- failing issue-backed run needing diagnosis => `Next: /skill:debug <id>`
