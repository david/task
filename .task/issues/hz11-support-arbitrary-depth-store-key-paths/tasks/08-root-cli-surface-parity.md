---
name: 08-root-cli-surface-parity
role: coder
depends_on: []
source: plan
source_key: research:plan
batch: taskify-history:run-002
---

# 08 — Root CLI surface parity

## Goal
Bring the supported repo-root CLI entrypoint onto the approved `task set`, `task get`, and `task delete --key <path>` surface so `bun task.ts` no longer advertises or depends on the legacy `task store ...` contract.

## Context
The approved plan and QA intent treat the repo-root entrypoint as part of the supported user-facing surface, but the current root `task.ts` and `commands.ts` still expose `task store set|get|keys|delete`. This task should remove that surface drift, preferably by delegating the root entrypoint to the already-updated `src/` command registry instead of keeping two independent document-command implementations.

## Files
- `task.ts`
- `commands.ts`
- `task.test.ts`
- `src/task.ts` if the root entrypoint delegates through shared CLI behavior
- `src/commands-registry.ts` if the root entrypoint reuses the staged command registry directly

## Verification Tests
- `bun test task.test.ts`
- `bun task.ts --help`
- a focused root-entrypoint regression that proves invalid `--key` paths still fail clearly through `bun task.ts`

## Out of Scope
- updating the supported docs under `doc/` and `src/doc/`
- full-repo verification reruns
- changing the underlying document-path validation rules beyond wiring the root surface to the supported implementation

## UI Scope Guardrails
- keep unrelated legacy commands stable while replacing only the issue-document command/help surface
- do not preserve `task store ...` as a supported compatibility alias in repo-root help or registration

## Done When
- `bun task.ts --help` advertises `set`, `get`, and `delete` for issue documents
- repo-root help and dispatch no longer expose `store set|get|keys|delete` as the supported document workflow
- the root entrypoint uses the same approved document-path behavior as the staged `src/` surface instead of maintaining a contradictory contract
- focused root help and invalid-path regressions pass
- no leftover partial edits for this task
