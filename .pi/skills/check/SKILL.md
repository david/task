---
name: check
description: Project-local branch confirmation workflow for the task CLI repo. Extends the packaged check skill with repo-local issue documents, exact commands, and handoffs.
---

# Check — task repo local override

This repo overrides the packaged `check` skill for the task repo.

Read these before acting:
1. `../../../skills/check/SKILL.md`
2. `../task/SKILL.md`
3. `../../task-workflow.md`
4. `../../../AGENTS.md`
5. `../../../doc/testing.md`

Apply the packaged base skill as the base workflow. The rules below replace generic
issue-storage and gate-command instructions.

## Local gates

Run these exact commands for the root `task` CLI repo:

```bash
bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff --workflow-gate --advisory-tests
bun test
bun run lint
bun run typecheck
/skill:global-review --branch
```

## Local issue-backed context

When an issue is in play, read durable context from:
- `tasks/`
- `task-status/`
- `code-history/`
- `check-report/`

Use `bun task.ts get` and `bun task.ts show --id <id> --include-keys`; do not
use undocumented store commands.

## Local reports

- Append full reports under `check-report/run-00N`.
- Refresh the pointer at `check-report/latest`.
- Even passing runs must write both documents.

## Local handoffs

- passing issue-backed run => `Next: /skill:qa <id>`
- failing issue-backed run with clear repair slices => `Next: /skill:taskify <id> --from check`
- failing issue-backed run needing diagnosis => `Next: /skill:debug <id>`
