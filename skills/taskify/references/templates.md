# Taskify Templates

Use these headings as the default structure. Adapt artifact names and paths to
the current repo.

## Durable task template

```markdown
---
name: 01-short-slug
role: coder
depends_on: []
source: plan
source_key: <approved handoff or check artifact>
batch: <taskification history key>
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

## Durable taskification-history template

```markdown
# Taskify Run

## Metadata
- Work item: <id or none>
- Timestamp: <ISO-8601 UTC>
- Source: plan | check | conversation
- Source key: <artifact key or none>
- Trigger: <exact command>

## Existing Task State
- Existing task count: <n>
- Highest existing task number: <NN or none>
- Existing completed tasks:
  - <NN-key>
  - none

## Taskification Policy
- Mode: append-only | fresh conversation list
- Start numbering at: <NN or 01>
- Why this shape: <short explanation>

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
- Final handoff line: <exact next line>
```

## Conversation response template

```markdown
# Task Breakdown

## Metadata
- Source: conversation
- Trigger: <exact command>

## Assumptions
- none

## Tasks

### 01 — Short title
- Depends on: none
- Goal: concrete outcome for this task
- Context: why this task exists in the current conversation
- Files:
  - likely/file.ts
- Surfaces:
  - related docs, tests, or mirrored user-facing surfaces
  - None
- Verification:
  - targeted proof for this task
- Out of scope:
  - what this task must not expand into
- Done when:
  - concrete completion conditions

## Suggested Next Step
- Suggested next command: /skill:code
- First task: 01
```
