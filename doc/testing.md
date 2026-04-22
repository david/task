# Testing

Use this doc when you change command behavior, storage rules, flag parsing, or output contracts.

## Main commands

```bash
bun test
bun run typecheck
```

Run both for the whole project before considering work done. Passing only changed files is not enough.

## What each test file covers

- `commands.test.ts` — command semantics, issue storage layout, archive behavior, metadata updates, relationship queries, and store operations.
- `task.test.ts` — argv parsing, help text, JSON/JSONL formatting, positional ID normalization, and subprocess-level CLI behavior.

## Choosing the right test target

If you change:

- flag parsing or dispatch in `task.ts` — update `task.test.ts`
- issue persistence or command semantics in `commands.ts` — update `commands.test.ts`
- shared command typing in `types.ts` — update whichever tests exercise the affected contract

## Test style expectations

- Prefer behavior tests over implementation-detail tests.
- Verify JSON shape, not just exit success.
- Exercise both normal paths and failure paths for user-facing commands.
- Keep tests explicit about archive vs active issue behavior.
- Use temp directories for storage isolation instead of touching the real issue root.

## Quality bar

- `bun test` must pass.
- `bun run typecheck` must pass.
- Broken windows principle applies: pre-existing failures, warnings, or type issues are problems to fix, not noise to ignore.
- If requirements are ambiguous, ask instead of guessing and baking the guess into tests.

## Current environment note

The root project defines `typecheck` as `tsc --noEmit`. If that command fails because of repo or environment setup, treat it as a real project problem and fix or surface it rather than silently skipping typechecking.

## Issue-backed `/skill:check` workflow

When `/skill:check` runs for an issue in this repo:

- use the exact commands listed in `doc/task-workflow.md` under `## Repo verification commands`
- run `/skill:global-review --branch`
- read durable context from `tasks/`, `task-status/`, `code-history/`, and `check-report/` with `bun task.ts get` and `bun task.ts show --id <id> --include-keys`
- append full reports under `check-report/run-00N`
- refresh the pointer at `check-report/latest`
- even passing runs must write both documents

Issue-backed handoffs are:
- passing run => `Next: /skill:qa <id>`
- failing run with clear repair slices => `Next: /skill:taskify <id> --from check`
- failing run needing diagnosis => `Next: /skill:debug <id>`
