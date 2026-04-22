---
name: check
description: >
  Run the full branch-level automated confirmation gates after /skill:code:
  repo-specific lint, test suites, typecheck, and a semantic
  `/skill:global-review --branch` pass. For issue-backed workflows, append a
  durable check report when the repo defines one. Use before /skill:qa or as a
  standalone quality check.
---

# Check — Code Quality Gates

Run automated quality checks against the codebase.

If the repo has a project-local override or project docs for check workflow,
follow them. Treat this skill as the generalized base workflow.

## Workflow role

This is the post-code full-branch confirmation step.
`/skill:code` should already have performed targeted verification for the active
slice. `/skill:check` confirms whether the branch is clean enough for QA or the
next stage, runs `/skill:global-review --branch`, and writes a durable report
when the repo's workflow expects one.

## Context reads for issue-backed runs

If an issue or work item is in play, read the repo's documented durable context:
- task graph or work items
- task status / run history
- prior check reports
- approved handoff artifacts

Use those signals to understand what was just implemented and whether this is a
recheck. Do not gate execution on bookkeeping alone.

## Gates

### 1. Repo-specific lint / custom analysis

Run any diff lint, custom lint, or workflow-gate command the repo documents.
If the repo defines none, skip this gate rather than inventing one.

### 2. Tests

Read the project's docs and run the documented full test command(s).

### 3. Project lint & typecheck

Run the documented full lint and typecheck command(s).
Zero unexpected warnings and zero errors are the default bar unless the project
docs explicitly say otherwise.

### 4. Semantic review

After the automated gates complete, run:

```text
/skill:global-review --branch
```

Treat this as required semantic review, not as optional color.
If it surfaces a concrete blocker, fail the overall check.

## Durable report policy

If the repo defines a durable check-report artifact, append a new report even on
pass and refresh any latest-pointer artifact the project uses.

At minimum, record:
- metadata (issue/work item, timestamp, verdict)
- exact commands run
- gate results
- concrete findings with rerun hints
- semantic-review summary

## Handoff

- standalone => report the results
- issue-backed pass => hand off to the repo's QA step when there is one
- issue-backed fail => hand off to decomposition or diagnosis based on whether
  the failures are already clearly separable

## Rules

- Do not invent project report locations or command names; infer them from the
  repo or ask.
- Treat missing QA evidence as missing, not as a silent pass.
