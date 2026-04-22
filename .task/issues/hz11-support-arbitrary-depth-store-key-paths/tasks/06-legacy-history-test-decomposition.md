---
name: 06-legacy-history-test-decomposition
role: coder
depends_on:
  - 05-legacy-history-nullable-prop
source: check
source_key: check-report:run-001
batch: taskify-history:run-001
---

# 06 — Legacy history test decomposition

## Goal
Refactor `src/commands-document-legacy-history.test.ts` so the oversized `describe` callback and three oversized test bodies are decomposed into smaller helpers or setup routines that satisfy the function-size lint rule without changing test coverage.

## Context
The failed check reported four `function-too-large` findings in the same file: the top-level `describe` callback and three individual test bodies. This is one file-local repair slice centered on extracting shared setup/assertion helpers and shrinking each callback below the lint threshold.

## Files
- `src/commands-document-legacy-history.test.ts`

## Verification Tests
- `bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --files=src/commands-document-legacy-history.test.ts --check=function-size --verbose`
- `bun test src/commands-document-legacy-history.test.ts`

## Out of Scope
- changing the product behavior under test
- unrelated cleanup in other test files
- full-branch reruns

## UI Scope Guardrails
- None

## Done When
- the top-level `describe` callback in `src/commands-document-legacy-history.test.ts` is below the function-size threshold
- each flagged test body in that file is below the function-size threshold
- the focused test file still passes after the refactor
- no leftover partial edits for this task
