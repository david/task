---
name: debug
description: >
  Investigate bugs and QA failures by clarifying the observable symptom and
  reproduction, tracing the failing path, and producing a diagnosis plus fix
  plan without writing the fix. Use for broken behavior, regressions, errors,
  failing tests, investigations, and QA failure analysis.
---

# Debug — Investigate, Diagnose, Plan

Investigate bugs and produce an implementation-ready diagnosis.
**Do not write the fix.**

Before broad exploration, read and follow:
- `../references/scoped-discovery.md`
- `../references/decision-batching.md` when clarification is needed
- `../references/behavior-concentration.md`
- `../references/scannable-output.md`

Also read these when the investigation touches the relevant surface:
- `../references/event-contract-validation.md`
- `../references/auth-access-analysis.md`
- `../references/automation-readmodel-replay-analysis.md`
- `../references/invariants-observability-analysis.md`

Also read repo context files such as `AGENTS.md`, `CLAUDE.md`, and relevant
project docs before choosing issue workflow, artifact paths, or handoffs.

If the repo has a project-local override or project docs for bug workflow,
follow them. Treat this skill as the generalized base workflow.

## Workflow model

Prefer an issue-backed, artifact-first workflow when the project documents one:
- reuse the issue already in play when possible
- otherwise create one once the bug is framed clearly enough
- read durable reproduction / QA / prior-planning artifacts before asking for
  missing context
- write durable diagnosis artifacts when the repo documents where they belong
- if the repo does not define durable artifacts, present the diagnosis directly
  in the conversation

Do not rely on rigid workflow-state metadata unless the project explicitly does.

## User-facing response style

In every user-facing response:
- start with `## At a Glance`
- then `## Questions for You` when blocking decisions remain
- then `## Defaults I Will Use` for non-blocking choices
- put evidence under `## Details`
- include `Next handoff:` with the exact command when determinable, or state
  exactly what blocks choosing one
- end with `Next views available:` and a short menu of the next 2–4 useful
  slices, not the full chain unless the user asks

## Workflow

### 1. Frame the bug

Start from observable behavior:
- what happened
- what was expected instead
- how to reproduce it
- who sees it / in what role / in what environment
- whether there is already a failing test, stack trace, or QA artifact
- whether the failure may involve duplicated or scattered ownership of the same
  business rule

Summarize the bug back before deeper root-cause hunting.

### 2. Resolve the project workflow

Inspect repo docs and current context to determine:
- whether an issue should be reused or created
- whether QA artifacts or prior diagnoses exist
- where durable diagnosis / plan artifacts belong
- what the exact next command is after diagnosis when it is knowable
  (`/skill:taskify <id> --from plan`, `/skill:code <id> <task-key>`,
  `/skill:feature <id>`, `/skill:refactor <id>`, or none)

If the project has no issue workflow, continue in conversation-only mode.

### 3. Research & diagnose

Trace the concrete failing behavior through the relevant implementation and
state until you can name the mechanism precisely.

After the first pass, summarize:
- the most likely failing path
- the strongest current root-cause hypothesis
- the best supporting evidence
- whether duplicated or scattered behavior appears causal, contributing, or
  unrelated
- the likely canonical owner for the broken rule when relevant
- the most important missing confirmation
- the next file, artifact, or command to inspect

When behavior ownership is relevant, include a compact `## Behavior
Concentration Scan` covering current locations, likely canonical owner, whether
the spread is intentional or risky, and how it relates to the bug.

Do not continue broad exploration without a named hypothesis and next check.

### 4. Produce the diagnosis

Make the following explicit when relevant:
- broken contract or expectation
- root cause
- `## Behavior Concentration Scan`
- validation or access failure
- side-effect / state / read-model failure
- regression history or prior learning
- proposed fix direction
- why existing verification missed it
- verification contract for the fix
- disposition

Use this standard table inside `## Behavior Concentration Scan` when relevant:

| Behavior / Rule | Current locations | Likely canonical owner | Spread type | Risk | Relation to bug | Recommended action |
|---|---|---|---|---|---|---|
| `<rule>` | `<locations>` | `<owner>` | `<type>` | `<risk>` | `<causal|contributing|unrelated>` | `<action>` |

Disposition should resolve to one of:
- `bugfix-now`
- `needs-feature-spec`
- `needs-refactor-plan`
- `split`

### 5. Persist and hand off

If the project defines durable diagnosis artifacts, write them before claiming
completion.

If the diagnosis is implementation-ready and the project defines an approved
handoff artifact, write that too.

Then hand off according to the repo workflow:
- print the exact next command, not just the skill name
- include issue ID, task key, and flags when known
- use implementation decomposition or coding when the fix is clear
- use feature planning when the solution is really a behavior change
- use refactor planning when structural change dominates

## Rules

- Investigate only; do not code the fix.
- Read existing durable artifacts before asking for already-known context.
- Do not call the diagnosis implementation-ready until the broken contract and
  likely fix owner are named.
- During research, explicitly check whether drift between duplicated or
  scattered behavior is the root cause, a contributing cause, or unrelated.
  Name the likely canonical owner when relevant.
- Do not invent project artifact names or handoff commands; infer them from the
  repo or ask.
- Never say only `/skill:taskify`, `/skill:code`, `/skill:feature`, or
  `/skill:refactor` when the exact routed command is recoverable.
