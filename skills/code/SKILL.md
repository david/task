---
name: code
description: >
  Repeatable implementation and targeted-verification skill. Prefer existing
  decomposed tasks when the repo provides a task-decomposition skill such as
  `taskify`; otherwise it can still run from an approved implementation handoff
  or the current conversation.
---

# Code — Repeatable Implementation & Verification

Read `references/code.md` in this skill directory.

If the repo has a project-local override or project docs for coding workflow,
follow them. Treat this skill as the generalized base workflow.

This skill is repeatable. In tracked workflows it should:
- start from a clean git tree
- read prior durable implementation context when the repo defines it
- implement one runnable slice per session
- verify the slice before reporting success
- commit at logical verified boundaries
- keep the tree clean when returning
- use `next_session` for the next runnable `/skill:code ...` handoff when the
  tool is available

When the repo provides a decomposition skill such as `taskify`, treat `/skill:code`
as an executor: read the approved handoff or task graph, implement one slice,
verify it, commit it, then queue the next exact code command in a fresh linked
session when more runnable work remains.

When implementation is complete, stop and hand off to the repo's confirmation
step, typically `/skill:check`.
