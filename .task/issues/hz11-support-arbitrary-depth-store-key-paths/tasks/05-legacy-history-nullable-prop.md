---
name: 05-legacy-history-nullable-prop
role: coder
depends_on: []
source: check
source_key: check-report:run-001
batch: taskify-history:run-001
---

# 05 — Legacy history nullable prop cleanup

## Goal
Remove the `optional-prop` lint finding in `src/commands-document-legacy-history.test.ts` by rewriting the local event helper type so it does not use an optional property declaration.

## Context
`/skill:check` failed on `check-report:run-001` because the legacy-history test helper declares `supersedesRevision?: number`. That single declaration blocks the branch even though tests, project lint, and typecheck already pass.

## Files
- `src/commands-document-legacy-history.test.ts`

## Verification Tests
- `bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --files=src/commands-document-legacy-history.test.ts --check=nullable-props --verbose`
- `bun test src/commands-document-legacy-history.test.ts`

## Out of Scope
- refactoring oversized test bodies beyond what is required to remove the optional-property lint finding
- full-branch reruns

## UI Scope Guardrails
- None

## Done When
- the local event helper type in `src/commands-document-legacy-history.test.ts` no longer uses an optional property form flagged by custom lint
- the nullable-props recheck for that file returns zero findings
- no unrelated behavior changes are introduced in the legacy-history tests
- no leftover partial edits for this task
