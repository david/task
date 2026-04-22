# Taskify Templates

Use these headings and key shapes for the task-backed workflow.

## Durable task template (`tasks/NN-*`)

```markdown
---
name: 01-short-slug
role: coder
depends_on: []
source: plan
source_key: research:plan | check-report:run-00N
batch: taskify-history:run-001
---

# 01 — Short title

## Goal
Concrete outcome for this task.

## Context
Why this task exists and how it fits the approved handoff or failed check.

## Files
- likely/file.ts
- likely/other-file.tsx

## Surfaces
- counterpart docs, schemas, tests, UI/API/CLI entrypoints, or mirrored surfaces that must stay aligned
- None

## Verification
- targeted automated proof for this task
- observable or wiring proof for this task
- narrow rerun command when relevant

## Out of Scope
- what this task must not expand into

## Done When
- concrete completion conditions
- task-specific success signal
- no leftover partial edits for this task
```

## Durable taskification-history template (`taskify-history/run-*`)

```markdown
# Taskify Run

## Metadata
- Issue: <id>
- Timestamp: <ISO-8601 UTC>
- Source: plan | check
- Source key: research/plan | check-report/run-00N
- Trigger: /skill:taskify <id> --from plan|check

## Existing Task State
- Existing task count: <n>
- Highest existing task number: <NN or none>
- Existing completed tasks:
  - <NN-key>
  - none

## Taskification Policy
- Mode: append-only
- Start numbering at: <NN>
- Why append instead of rewrite: preserve prior approved/task execution history

## Tasks Created
- <NN-key> — <short title>
- none

## Task Boundaries
### <NN-key>
- Goal: <why this is one task>
- Depends on: <task keys or none>
- Verification focus: <targeted proof>
- Why separate: <reason>

## Coverage Check
- In-scope work covered: yes | no
- Cross-cutting verification captured: yes | no
- Remaining ambiguity: none | <description>

## Next Step
- First new task: <first-new-task-key or none>
- Final handoff line: Next: /skill:code <id> <first-new-task-key>
```

## Latest pointer template (`taskify-history/latest`)

```markdown
# Latest Taskify Run

- Latest key: run-00N
- Source: plan | check
- Tasks created:
  - <NN-key>
  - none
```
