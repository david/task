# Local rules for `/skill:debug`

## Local workflow contract

- Always use issue-backed mode once the bug is framed.
- Use `bun task.ts` from the repo root.
- Create a new issue with label `bug` when there is no active issue.
- Read existing durable context from `research/`, `tasks/`, `task-status/`, `qa-results/`, `qa-context/`, `check-report/`, and `code-history/` document trees.
- Store the first diagnosis at `research/diagnosis`.
- Store later retries at `research/diagnosis-retry-N`.
- Store the approved implementation handoff at `research/plan` when the disposition is implementation-ready.
- Store QA retrospectives at `research/retro-<slug>`.
- Use `bun task.ts set --id <id> --key <path> --file /tmp/<file>.md` for durable writes.
- Do not use undocumented `task store ...` commands.

## Local issue creation

```bash
bun task.ts create --title "<concise bug description>" --label bug
```

## Local handoffs

End with exactly one of:
- `Next: /skill:taskify <id> --from plan`
- `Next: /skill:feature <id>`
- `Next: /skill:refactor <id>`
