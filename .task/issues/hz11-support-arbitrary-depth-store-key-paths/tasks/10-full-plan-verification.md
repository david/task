---
name: 10-full-plan-verification
role: coder
depends_on:
  - 08-root-cli-surface-parity
  - 09-supported-docs-parity
source: plan
source_key: research:plan
batch: taskify-history:run-002
---

# 10 — Full plan verification

## Goal
Run the full confirmation pass for the repaired root CLI/help/docs surface so the issue can return to QA with the approved user-facing contract fully rechecked.

## Context
This repair closes a QA-discovered gap between the implemented `src/` document commands and the still-supported root entrypoint/docs. After the focused CLI and doc updates land, the branch needs the normal repo-wide automated proof plus the fast help/doc rechecks called out in the approved plan.

## Files
- `task.ts`
- `commands.ts`
- `task.test.ts`
- `doc/commands.md`
- `doc/project-management.md`
- `doc/architecture.md`
- `src/doc/commands.md`
- `src/doc/project-management.md`
- `src/doc/architecture.md`
- any files touched by tasks 08 and 09

## Verification Tests
- `bun task.ts --help`
- `bun src/task.ts --help` if that entrypoint remains supported
- `rg -n "task store|bun task\\.ts|bin/task" doc src/doc`
- `bun test`
- `bun run typecheck`

## Out of Scope
- additional feature work beyond the approved help/docs parity repair
- speculative cleanup unrelated to the user-facing document surface

## UI Scope Guardrails
- None

## Done When
- root help and any retained staged help surface both show the approved document command family
- supported docs are free of legacy `task store ...` instructions and stale wrapper guidance
- `bun test` passes for the full repo
- `bun run typecheck` passes for the full repo
- no leftover partial edits for this task
