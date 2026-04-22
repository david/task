---
name: code
description: Project-local `task` execution workflow for the task CLI repo. Extends the packaged code skill with repo-local issue documents, verification commands, and handoffs.
---

# Code — task repo local override

This repo overrides the packaged `code` skill for the task repo.

Read these before acting:
1. `../../../skills/code/SKILL.md`
2. `../../../skills/code/references/code.md`
3. `../task/SKILL.md`
4. `../../task-workflow.md`
5. `../../../AGENTS.md`
6. `../../../doc/testing.md`
7. `../../../doc/code-style.md`

Apply the packaged base skill as the base workflow. The rules below replace generic
tracked-workflow storage and verification instructions.

## Local tracked mode contract

- Tracked runs in this repo are issue-backed and document-backed.
- Read durable context from `research/plan`, `tasks/`, `task-status/`, `code-history/`, `taskify-history/`, and `check-report/` via `bun task.ts get`.
- Use `bun task.ts show --id <id> --include-keys` to discover the current document graph.
- Mark task completion with `task-status/<task-key>` documents, using values like `done` or `failed:<reason>`.
- Append run records under `code-history/run-00N` and refresh `code-history/latest`.
- Keep one runnable task-sized slice per session.
- Keep the git tree clean before and after the run.

## Local verification commands

When full repo verification is required by the active task, use:

```bash
bun test
bun run lint
bun run typecheck
bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff
```

Use narrower targeted tests first, then the full repo commands above when the
workflow requires them.

## Local handoff rules

- More runnable implementation work => hand off to `/skill:code <id> <next-task-key>` when clear.
- Implementation complete => hand off to `/skill:check --issue <id>`.
- Persist the exact next command in the `code-history` record.
