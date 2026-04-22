---
name: taskify
description: Turn an issue's approved `research/plan` or latest failed `check-report` into durable append-only execution tasks plus `taskify-history` records. Use in the task-backed workflow after feature, debug, refactor, or failed check.
---

# Taskify

Read `references/templates.md` before writing task batches or history.

If `doc/task-workflow.md` exists, read it before acting.
If `doc/decomposition.md` exists, read it before acting.

Treat repo docs as project-specific extensions of this skill.

## Goal

Decompose approved task-backed work into small execution tasks.

This skill is intentionally issue-backed:
- source planning comes from `research/plan` or a failed `check-report`
- tasks are written to `tasks/NN-*`
- taskification history is written to `taskify-history/run-*` and `taskify-history/latest`
- the normal handoff is `Next: /skill:code <id> <first-new-task-key>`

Do not rely on rigid workflow-state metadata.

## Debug-first policy

Do not use taskification as the default first reaction to unclear runtime
failures. Test failures, timeouts, crashes, flakiness, and similar symptoms go
to diagnosis first unless the failed `check-report` already describes a clear,
separable repair batch.

## Inputs

Supported forms:
- `/skill:taskify <id> --from plan`
- `/skill:taskify <id> --from check`
- `/skill:taskify <id>` when repo docs make the source unambiguous

If no issue-backed source is available, stop and ask instead of inventing a
parallel conversation-only workflow.

## Source artifacts

### Source = `plan`

Read:
- `research/plan`
- `tasks/`
- `task-status/`
- `taskify-history/`
- `code-history/` when useful for continuity

Use `research/plan` as the authoritative scope ceiling.
Append new tasks when the current approved plan is broader or newer than the
existing task graph.

### Source = `check`

Read:
- `check-report/latest`
- the pointed `check-report/run-*`
- `tasks/`
- `task-status/`
- `taskify-history/`
- `code-history/` when useful for repair context

Only decompose **clear, separable** repair work from blocking findings.
If the failed check is dominated by unclear runtime behavior, hand off to
`/skill:debug <id>` instead.

## Task graph rules

- task bodies are append-only `tasks/NN-*`
- task numbering is zero-padded and monotonic within the issue
- do not rewrite old task bodies; append new tasks instead
- each new batch must write:
  - one or more `tasks/NN-*` documents
  - `taskify-history/run-*`
  - `taskify-history/latest`
- read back each newly written task before continuing

## Task boundary rules

- small, ordered, independently verifiable tasks
- one logical execution slice per task
- prefer explicit dependencies
- include likely files and counterpart surfaces when the source artifact supports that confidence
- reserve full-batch reruns for the final verification-oriented task when appropriate

## Handoff

After successful taskification:
- hand off with `Next: /skill:code <id> <first-new-task-key>` when clear
- otherwise hand off with `Next: /skill:code <id>`

If blocked by the diagnosis-first policy, end with:
- `Next: /skill:debug <id>`

## Rules

- This package's workflow is task-backed; do not fall back to ad hoc conversation-mode task lists here.
- Append rather than rewrite prior durable task history.
- Do not invent repo artifact names or task-history locations; infer them from
  `doc/task-workflow.md` and repo docs.
- Do not code anything in this skill.
