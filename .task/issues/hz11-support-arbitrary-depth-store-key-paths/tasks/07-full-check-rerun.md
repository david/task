---
name: 07-full-check-rerun
role: coder
depends_on:
  - 05-legacy-history-nullable-prop
  - 06-legacy-history-test-decomposition
source: check
source_key: check-report:run-001
batch: taskify-history:run-001
---

# 07 — Full check rerun

## Goal
Re-run the branch-level confirmation gates after the legacy-history lint repairs so the issue can move back from `code-failed` toward QA readiness.

## Context
`check-report:run-001` failed only because custom diff lint found five blocking findings in `src/commands-document-legacy-history.test.ts`. After the focused repairs land, this final task confirms the full branch is clean again.

## Files
- `src/commands-document-legacy-history.test.ts`
- any files touched by tasks 05 and 06

## Verification Tests
- `bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff`
- `bun run lint`
- `bun test`
- `bun run typecheck`

## Out of Scope
- new feature work beyond the failed-check repairs
- speculative cleanup unrelated to the reported findings

## UI Scope Guardrails
- None

## Done When
- custom diff lint reports zero findings
- project lint passes
- full test suite passes
- typecheck passes
- no leftover partial edits for this task
