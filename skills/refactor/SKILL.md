---
name: refactor
description: >
  Plan behavior-preserving refactors. First clarify the structural goal,
  behavioral invariants, and scope boundaries; then inspect the relevant code
  and tests; then write a refactor plan without changing behavior. Use for
  restructuring, extraction, renaming, cleanup, simplification, code
  reorganization, and large refactor planning.
---

# Refactor — Restructure Without Changing Behavior

The cardinal rule: behavior stays identical. If the work needs a behavioral
change, route to feature or debug instead.

Before broad exploration, read and follow:
- `../references/scoped-discovery.md`
- `../references/decision-batching.md` when structural choices need user input
- `../references/behavior-concentration.md`
- `../references/scannable-output.md`

Also read these when the candidate refactor touches the relevant surface:
- `../references/event-contract-validation.md`
- `../references/auth-access-analysis.md`
- `../references/automation-readmodel-replay-analysis.md`
- `../references/invariants-observability-analysis.md`

Also read repo context files such as `AGENTS.md`, `CLAUDE.md`, and relevant
project docs before choosing issue workflow, artifact paths, or handoffs.

If the repo has a project-local override or project docs for refactor workflow,
follow them. Treat this skill as the generalized base workflow.

## Workflow model

Prefer a durable planning workflow when the repo documents one:
- reuse an issue already in play when possible
- otherwise create one once the refactor goal is framed clearly enough
- write durable planning artifacts when the project expects them
- if the project has no issue workflow, present the plan in conversation

Do not rely on rigid workflow-state metadata unless the project explicitly does.

## User-facing response style

In every user-facing response:
- start with `## At a Glance`
- then `## Questions for You` when blocking decisions remain
- then `## Defaults I Will Use` for non-blocking choices
- put detailed structural reasoning under `## Details`
- include `Next handoff:` with the exact command when determinable, or state
  exactly what blocks choosing one
- end with `Next views available:` and a short menu of the next 2–4 useful
  slices, not the full chain unless the user asks

## Workflow

### 1. Frame the refactor

Clarify:
- the structural change the user wants
- why they want it
- what behavior must stay unchanged
- scope and blast radius
- whether reducing scattered or duplicated ownership is part of the goal
- which contracts must stay identical

Protected contracts commonly include:
- external requests / responses / CLI output
- stored data or event shapes
- access semantics
- side effects and state transitions
- validation outcomes
- diagnostics or observability signals

### 2. Resolve the project workflow

Inspect repo docs and current context to determine:
- whether an issue should be reused or created
- whether the project expects a durable refactor plan artifact
- what the canonical handoff artifact is
- whether the repo uses a decomposition skill before coding
- what the exact next command is after approval when it is knowable
  (`/skill:taskify <id> --from plan`, `/skill:code <id>`, or none)

### 3. Assess coverage and planning needs

Inspect the relevant tests and record:
- existing protection of current behavior
- characterization tests still needed
- the contracts most at risk during the refactor
- current scattered or duplicated behavior and the likely consolidation target
- remaining structural uncertainty

When behavior ownership is relevant, include a compact `## Behavior
Concentration Scan` covering current locations, likely canonical owner, whether
the spread is intentional or risky, and whether this refactor should preserve
or consolidate it.

### 4. Write the plan

A good refactor plan should cover:
- goal
- current structure
- target structure
- `## Behavior Concentration Scan`
- behavioral invariants
- protected contracts
- preserved access / side effects / state behavior
- characterization-test needs
- sequencing / ordering constraints
- verification contract

Use this standard table inside `## Behavior Concentration Scan` when relevant:

| Behavior / Rule | Current locations | Likely canonical owner | Spread type | Risk | Refactor action |
|---|---|---|---|---|---|
| `<rule>` | `<locations>` | `<owner>` | `<type>` | `<risk>` | `<preserve|delegate|consolidate>` |

If any required contract would change, stop calling it a refactor and route out.

### 5. Persist and hand off

If the project defines durable planning artifacts, write them before claiming
completion.

Then hand off according to the repo workflow:
- print the exact next command, not just the skill name
- include issue ID, task key, and flags when known
- usually route to decomposition or coding

## Rules

- Planning only; do not execute the refactor.
- No behavior changes.
- Keep protected contracts explicit enough that later coding does not need to
  guess what must stay the same.
- During research, explicitly map scattered or duplicated behavior, name the
  likely canonical owner, and state whether the refactor should preserve,
  delegate, or consolidate that ownership.
- Do not invent project artifact names or handoff commands; infer them from the
  repo or ask.
- Never say only `/skill:taskify` or `/skill:code` when the exact routed
  command is recoverable.
