# Local rules for `/skill:code`

## Local tracked mode contract

- Tracked runs in this repo are issue-backed and document-backed.
- Read durable context from `research/plan`, `tasks/`, `task-status/`, `code-history/`, `taskify-history/`, and `check-report/` via `bun task.ts get`.
- Use `bun task.ts show --id <id> --include-keys` to discover the current document graph.
- Mark task completion with `task-status/<task-key>` documents, using values like `done` or `failed:<reason>`.
- Append run records under `code-history/run-00N` and refresh `code-history/latest`.
- Keep one runnable task-sized slice per session.
- Keep the git tree clean before and after the run.

## Local verification commands

Use the exact commands listed in `doc/task-workflow.md` under `## Repo verification commands`.

## Local handoff rules

- More runnable implementation work => hand off to `/skill:code <id> <next-task-key>` when clear.
- Implementation complete => hand off to `/skill:check --issue <id>`.
- Persist the exact next command in the `code-history` record.
