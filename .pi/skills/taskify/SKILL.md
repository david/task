---
name: taskify
description: Project-local task decomposition workflow for the task CLI repo. Extends the packaged taskify skill with repo-local document paths, append-only numbering, and handoffs.
---

# Taskify — task repo local override

This repo overrides the packaged `taskify` skill for the task repo.

Read these before acting:
1. `../../../skills/taskify/SKILL.md`
2. `../../../skills/taskify/references/templates.md`
3. `../task/SKILL.md`
4. `../../task-workflow.md`
5. `../../../AGENTS.md`
6. `../../../doc/project-management.md`

Apply the packaged base skill as the base workflow. The rules below replace generic
issue-storage and read/write instructions.

## Local document paths

Use these canonical issue document paths:
- approved handoff source: `research/plan`
- latest check pointer/report: `check-report/latest`, `check-report/run-00N`
- task bodies: `tasks/NN-<slug>`
- live task state: `task-status/NN-<slug>`
- taskification history: `taskify-history/run-00N`, `taskify-history/latest`
- prior coding context: `code-history/`

## Local read / write rules

- Discover existing documents with `bun task.ts show --id <id> --include-keys`.
- Read task and history trees with `bun task.ts get --id <id> --key tasks/` and `... --key taskify-history/`.
- Write each new task with `bun task.ts set --id <id> --key tasks/<NN-key> --file /tmp/<NN-key>.md`.
- Read back each newly written task before continuing.
- Write history records with `bun task.ts set` under `taskify-history/...`.
- Do not rewrite earlier task bodies; append new numbered tasks instead.

## Local handoffs

- successful issue-backed decomposition => `Next: /skill:code <id> <first-new-task-key>` when clear, else `Next: /skill:code <id>`
- blocked by debug-first policy or repair-loop cap => `Next: /skill:debug <id>`
