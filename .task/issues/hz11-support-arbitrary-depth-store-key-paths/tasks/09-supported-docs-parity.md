---
name: 09-supported-docs-parity
role: coder
depends_on:
  - 08-root-cli-surface-parity
source: plan
source_key: research:plan
batch: taskify-history:run-002
---

# 09 — Supported docs parity

## Goal
Update every supported root and `src/` doc surface to describe issue documents with `task set|get|delete --key <path>`, align entrypoint guidance, and add a regression guard that catches legacy `task store ...` examples in those docs.

## Context
The current docs still teach the old store/key workflow and disagree about whether users should run `bin/task`, `src/bin/task`, `bun task.ts`, or `bun src/task.ts`. The approved plan requires the supported docs to match the root CLI surface and to keep invalid-path guidance/examples accurate.

## Files
- `doc/commands.md`
- `doc/project-management.md`
- `doc/architecture.md`
- `src/doc/commands.md`
- `src/doc/project-management.md`
- `src/doc/architecture.md`
- `task.test.ts` or a small new Bun test file that asserts supported-doc parity

## Verification Tests
- `bun test task.test.ts`
- `rg -n "task store|store set|store get|store keys|store delete" doc src/doc`
- `rg -n "bun task\\.ts|bun src/task\\.ts|bin/task|src/bin/task" doc src/doc`

## Out of Scope
- changing command implementation beyond what task 08 already established
- editing unsupported docs outside the root `doc/` and `src/doc/` surfaces
- full-repo verification reruns

## UI Scope Guardrails
- cover every supported doc surface named in the plan instead of updating only the first copy encountered
- keep examples and terminology aligned with the approved `--key <path>` selectors, including subtree/root guidance where those docs mention reads or deletes

## Done When
- the supported docs no longer instruct users to use `task store ...` for issue documents
- root and staged docs agree on the supported wrapper/entrypoint guidance
- the docs describe issue documents with `--key <path>` rather than `--store` plus `--key`
- an automated guard exists for the supported docs so legacy examples do not silently return
- no leftover partial edits for this task
