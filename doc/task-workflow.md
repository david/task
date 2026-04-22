# Task Workflow Conventions for This Repo

This repo's workflow skills are intentionally **task-backed**.
Use the repo-local `task` CLI through `bun task.ts` from the repo root.

## Workflow philosophy

- `task` is the workflow substrate, not a side tool.
- Durable workflow state belongs in `task` issue documents and metadata.
- Workflow skills should coordinate through canonical issue-document paths, not
  ad hoc files or hidden bookkeeping.
- Repo-specific workflow customization belongs in `doc/task-workflow.md` and
  in project-native docs when they exist.
- Useful optional docs for these packaged skills include:
  - `doc/planning.md`
  - `doc/debugging.md`
  - `doc/refactoring.md`
  - `doc/coding.md`
  - `doc/committing.md`
  - `doc/testing.md`
  - `doc/decomposition.md`
  - `doc/deployment.md`

## Hard rules

- Prefer `bun task.ts`, not undocumented legacy aliases.
- Use documented document commands: `set`, `get`, `delete`, and `show --include-keys`.
- Do **not** use deprecated or undocumented `task store ...` commands in this repo.
- Use `--flag value`, never `--flag=value`.
- Keep larger workflow artifacts in issue documents, not metadata.
- Treat `.task/` as first-class committed project data.
- When code/docs correspond to issue/task/history changes, commit the related `.task` changes in the same logical commit.
- Exclude only clearly unrelated tracker churn from a task-backed commit.
- Use exact handoff commands. Do not hand off with only a bare skill name when the next command is knowable.

## Canonical issue document paths

These key names are the canonical workflow surface:

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

## Standard naming and status conventions

### Task keys

- executable task keys are zero-padded `NN-<slug>`
- examples: `01-parse-flags`, `02-update-help-text`

### Run keys

- history/report runs are zero-padded `run-00N`
- examples: `run-001`, `run-014`

### Pointer keys

- each append-only history store also has a mutable `latest` pointer document
- current pointer stores are:
  - `code-history/latest`
  - `check-report/latest`
  - `taskify-history/latest`

### Task-status values

- absence of a `task-status/<task-key>` document means `pending`
- success: `done`
- failure: `failed:<short reason>`

## Standard handoff commands

When the next step is known, use one of these exact forms:

- `Next: /skill:taskify <id> --from plan`
- `Next: /skill:taskify <id> --from check`
- `Next: /skill:code <id> <task-key>`
- `Next: /skill:code <id>`
- `Next: /skill:check --issue <id>`
- `Next: /skill:qa <id>`
- `Next: /skill:debug <id>`
- `Next: /skill:feature <id>`
- `Next: /skill:refactor <id>`

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

For pointer documents such as `latest`, write a small markdown document that
identifies the latest run key and summary status.

## Skill ownership and workflow matrix

| Skill | Creates issue | Reads | Writes | Completion signal | Standard handoff |
|---|---|---|---|---|---|
| `feature` | yes, when needed | current issue, `research/*` | `research/prd`, `research/plan` | both docs written | `Next: /skill:taskify <id> --from plan` |
| `debug` | yes, when needed | current issue, `research/*`, `tasks/*`, `task-status/*`, `qa-results/*`, `qa-context/*`, `check-report/*`, `code-history/*` | `research/diagnosis*`, optional `research/plan`, optional `research/retro-*` | diagnosis written; plan written when implementation-ready | `Next: /skill:taskify <id> --from plan` or `Next: /skill:feature <id>` or `Next: /skill:refactor <id>` |
| `refactor` | yes, when needed | current issue, `research/*` | `research/refactor-plan`, `research/plan` | both docs written | `Next: /skill:taskify <id> --from plan` |
| `taskify` | no | `research/plan`, `tasks/*`, `task-status/*`, `taskify-history/*`, optional `check-report/*`, optional `code-history/*` | `tasks/NN-*`, `taskify-history/run-*`, `taskify-history/latest` | new task batch + taskify history written | `Next: /skill:code <id> <first-new-task-key>` |
| `code` | no | `research/plan`, `tasks/*`, `task-status/*`, `taskify-history/*`, `code-history/*`, optional `check-report/*` | `task-status/*`, `code-history/run-*`, `code-history/latest` | one runnable task-sized slice completed and recorded | `Next: /skill:code <id> <next-task-key>` or `Next: /skill:check --issue <id>` |
| `commit` | no | git diff, staged state, related `.task/*` changes, optional workflow docs | git commits that include related `.task/*` state | verified logical slices are committed with matching tracker history | return to caller |
| `check` | no | `research/plan`, `tasks/*`, `task-status/*`, `code-history/*`, `check-report/*` | `check-report/run-*`, `check-report/latest` | new check report written | `Next: /skill:qa <id>` or `Next: /skill:taskify <id> --from check` or `Next: /skill:debug <id>` |
| `deploy` | no | `check-report/*`, `tasks/*`, `task-status/*`, `qa-results/*`, `qa-context/*` | none | deploy summary reported | none |

## Workflow spine

The standard task-backed workflow is:

```text
feature | debug | refactor
  ↓
research/plan
  ↓
taskify
  ↓
tasks/*
  ↓
code
  ↓
commit
  ↓
code-history/* + task-status/* + related .task/*
  ↓
check
  ↓
check-report/*
  ↓
qa (when used)
  ↓
deploy
```

## Repo verification commands

- Tests: `bun test`
- Lint: `bun run lint`
- Typecheck: `bun run typecheck`
- Diff lint: `bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff`
- Check workflow gate: `bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff --workflow-gate --advisory-tests`
