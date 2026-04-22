# Task Workflow Conventions for This Repo

Use the repo-local `task` CLI through `bun task.ts` from the repo root.

## Hard rules

- Prefer `bun task.ts`, not undocumented legacy aliases.
- Use documented document commands: `set`, `get`, `delete`, and `show --include-keys`.
- Do **not** use deprecated or undocumented `task store ...` commands in this repo.
- Use `--flag value`, never `--flag=value`.
- Keep larger workflow artifacts in issue documents, not metadata.

## Canonical issue document paths

Map workflow artifacts onto document keys like this:

- `research/prd`
- `research/plan`
- `research/diagnosis`
- `research/diagnosis-retry-N`
- `research/refactor-plan`
- `research/retro-<slug>`
- `tasks/NN-<slug>`
- `task-status/NN-<slug>`
- `code-history/run-00N`
- `code-history/latest`
- `check-report/run-00N`
- `check-report/latest`
- `taskify-history/run-00N`
- `taskify-history/latest`
- `qa-results/<qa-key>`
- `qa-context/<qa-key>`

## Read / inspect patterns

Use these commands to inspect issue-backed workflow state:

```bash
bun task.ts show --id <id> --compact
bun task.ts show --id <id> --include-keys
bun task.ts get --id <id> --key research/
bun task.ts get --id <id> --key tasks/
bun task.ts get --id <id> --key task-status/
bun task.ts get --id <id> --key code-history/
bun task.ts get --id <id> --key check-report/
bun task.ts get --id <id> --key taskify-history/
bun task.ts get --id <id> --key /
```

Use the narrowest selector that answers the question.

## Write patterns

```bash
bun task.ts set --id <id> --key research/plan --file /tmp/plan.md
bun task.ts set --id <id> --key tasks/01-example-task --file /tmp/task.md
bun task.ts set --id <id> --key task-status/01-example-task --value done
bun task.ts set --id <id> --key code-history/latest --file /tmp/latest.md
```

For pointers such as `latest`, write small markdown documents that identify the
current canonical run key and summary status.

## Repo verification commands

When a skill needs full-project verification in this repo, use:

```bash
bun test
bun run lint
bun run typecheck
```

For diff lint in this repo, use the global lint skill script when the workflow
calls for it:

```bash
bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff
```

For the stricter workflow-gate variant used by `/skill:check`, use:

```bash
bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff --workflow-gate --advisory-tests
```
