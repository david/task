---
name: taskify
description: Turn an approved implementation handoff or a clearly decomposable failed check into small execution tasks. Also supports ad-hoc conversation mode when no issue-backed workflow exists.
---

# Taskify

Read `references/templates.md` before writing task batches or history.

If the repo has a project-local override or project docs for decomposition,
follow them. Treat this skill as the generalized base workflow.

## Goal

Decompose approved work into small execution tasks.

Two modes:
- **Issue-backed mode** — derive durable append-only tasks from the repo's
  approved handoff and/or latest failed check artifact
- **Conversation mode** — derive an ad-hoc task list directly from the current
  conversation when the repo does not use issue-backed workflow

Do not rely on rigid workflow-state metadata unless the repo explicitly does.

## Debug-first policy

Do not use taskification as the default first reaction to unclear runtime
failures. Test failures, timeouts, crashes, flakiness, and similar symptoms go
to diagnosis first unless the failing report already describes a clear,
separable repair batch.

## Inputs

Supported shapes:
- approved implementation handoff
- latest clearly decomposable failed check report
- current conversation when no durable workflow exists

If the source is ambiguous, stop and ask instead of guessing.

## Issue-backed mode

### 1. Load current task graph and history

Read the existing task graph, task status, prior taskification history, approved
handoff, and latest check/report artifacts when they exist.

Treat old task bodies as immutable history. If a prior task body is malformed,
recover from surrounding context when possible instead of hard-stopping on
bookkeeping alone.

### 2. Source = approved handoff

Compare the current approved scope with the existing task graph.
Create the initial task graph or append missing tasks when the approved scope is
newer or broader than the old graph.

### 3. Source = failed check

Use only blocking findings by default.
Group them into safe execution slices rather than one raw finding per task.
If the report is dominated by unclear runtime behavior, route to diagnosis
instead of writing repair tasks.

### 4. Write and verify each new task

Write each new task using the template reference.
Populate likely files, counterpart surfaces, verification, and out-of-scope
notes when the source artifact supports that confidence.

Read each newly written task back before continuing.
Do not report success with unreadable task bodies.

### 5. Write taskification history

Append a history record and refresh any latest-pointer artifact the repo uses.
The history should identify the source artifact and the tasks created.

## Conversation mode

Re-read the conversation and extract only the work the user already approved or
clearly requested. If scope or sequencing is materially ambiguous, ask targeted
questions instead of fabricating tasks.

## Handoff

After successful taskification:
- issue-backed mode => hand off to `/skill:code` with the first new task key
  when clear
- conversation mode => hand off to `/skill:code`
- blocked by diagnosis-first policy => hand off to `/skill:debug`

## Rules

- Small, ordered, independently verifiable tasks.
- Append rather than rewrite prior durable task history.
- Do not invent repo artifact names or task-history locations; infer them from
  project docs or ask.
- Do not code anything in this skill.
