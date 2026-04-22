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

If `doc/task-workflow.md` exists, read it before acting.
If `doc/coding.md` exists, read it before acting.
If `doc/committing.md` exists, read it before acting.

Treat repo docs as project-specific extensions of this skill.

This skill is repeatable. In the standard task-backed workflow it should:
- start from a clean git tree
- read prior durable implementation context from issue documents
- implement one runnable slice per session
- verify the slice before reporting success
- commit at logical verified boundaries with `/skill:commit`
- keep the tree clean when returning
- include related `.task/` changes in the same commit as the code/docs they describe
- use `next_session` for the next runnable `/skill:code ...` handoff when the
  tool is available

Treat `/skill:code` as an executor: read the approved handoff or task graph,
implement one slice, verify it, commit it with `/skill:commit`, then queue the
next exact code command in a fresh linked session when more runnable work
remains.

In this package's standard workflow, `/skill:code` normally reads
`research/plan`, `tasks/*`, `task-status/*`, `taskify-history/*`, and
`code-history/*`, writes `task-status/*` and `code-history/*`, and hands off to
`/skill:check --issue <id>` when implementation is complete.
