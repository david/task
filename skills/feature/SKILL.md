---
name: feature
description: >
  Create a feature spec / PRD by clarifying the user's goal and scope, doing
  targeted code research, and interviewing further until the behavioral design
  is concrete enough to implement. Use for feature requests, specs, new
  capabilities, product requirements, and behavioral design work.
---

# Feature — Specification & Approved Handoff

You produce implementation-ready feature specs by combining user clarification,
code research, and staged review.

Before broad exploration, read and follow:
- `../references/scoped-discovery.md`
- `../references/decision-batching.md` when user decisions are needed
- `../references/behavior-concentration.md`
- `../references/scannable-output.md`

Also read these when the feature touches the relevant surface:
- `../references/event-contract-validation.md`
- `../references/auth-access-analysis.md`
- `../references/automation-readmodel-replay-analysis.md`
- `../references/invariants-observability-analysis.md`

Also read repo context files such as `AGENTS.md`, `CLAUDE.md`, and relevant
project docs before choosing issue workflow, artifact paths, or handoffs.

If the repo has a project-local override or project docs for feature planning,
follow them. Treat this skill as the generalized base workflow.

## Workflow model

Prefer an issue-backed, artifact-first workflow when the project documents one:
- reuse an issue already in play when possible
- otherwise create one only after the feature is framed well enough to title
- write durable planning artifacts when the repo documents where they belong
- if the repo does not define durable artifacts, present the PRD and approved
  handoff directly in the conversation

Do not rely on rigid workflow-state metadata unless the project explicitly does.

## User-facing response style

In every user-facing response:
- start with `## At a Glance`
- then `## Questions for You` when blocking decisions remain
- then `## Defaults I Will Use` for non-blocking choices
- put long reasoning under `## Details`
- include `Next handoff:` with the exact command when determinable, or state
  exactly what blocks choosing one
- end with `Next views available:` and a short menu of the next 2–4 useful
  slices, not the full chain unless the user asks

Use staged delivery by default:
1. summary + blocking questions only
2. one focused slice at a time
3. final draft only when review is ready

## Workflow

### 1. Frame the request

Clarify only what is needed to understand:
- the problem to solve
- the outcome the user wants
- what appears in scope vs out of scope
- whether this is truly new behavior or a change to something existing
- whether a full spec is warranted
- what boundaries, contracts, validation, access rules, side effects, views,
  migrations, or invariants are likely affected
- whether the request appears to extend an existing owner for the behavior or
  risks creating a second authority for the same rule

Do not ask questions the code can answer.

### 2. Resolve the project workflow

Before writing anything durable, inspect repo docs and the current context.
Determine:
- whether an issue should be reused or created
- whether the project expects durable planning artifacts
- the canonical artifact names/paths
- the canonical approved-handoff artifact, if any
- the exact next command after approval when it is knowable
  (`/skill:taskify <id> --from plan`, `/skill:code <id>`, another planner, or
  none)

If the project has no issue workflow, continue in conversation-only mode.

### 3. Do targeted research

Research only the relevant code, tests, and docs.
After the first pass, summarize:
- what already exists
- what seems reusable
- what constraints or coupling you found
- what duplicated or scattered behavior already exists
- the likely canonical owner for each important overlapping rule
- whether the feature should extend, preserve, or consolidate that behavior
- what remains uncertain
- whether drafting can begin

When behavior ownership is relevant, include a compact `## Behavior
Concentration Scan` covering current locations, likely canonical owner, whether
the spread is intentional or risky, and the recommended action.

If the requested feature already exists, say so immediately and switch to gap
analysis instead of writing a new PRD.

### 4. Align on observable verification

Before drafting, make sure you can state:
- who performs the action
- what success looks like
- what rejection/failure paths matter
- which invalid inputs or states must be rejected
- which actors are allowed or denied when that matters
- what downstream effects or updated views should happen
- what invariants must remain true

### 5. Draft the PRD

A strong PRD should cover, as applicable:
- problem
- solution overview
- user-observable scenarios
- event or state-model delta
- boundary/request/response changes
- auth/access implications
- validation plan
- `## Behavior Concentration Scan`
- side effects / automation impacts
- read-model / query impacts
- migration / replay / rollout notes
- critical invariants and observability
- verification contract
- non-goals and open questions

Use this standard table inside `## Behavior Concentration Scan` when relevant:

| Behavior / Rule | Current locations | Likely canonical owner | Spread type | Risk | Recommended action |
|---|---|---|---|---|---|
| `<rule>` | `<locations>` | `<owner>` | `<type>` | `<risk>` | `<action>` |

Adapt the headings to the repo. If the project is not event-sourced, do not
force event-centric sections; use the equivalent behavioral/contracts framing.

### 6. Review in stages

Default order:
- summary / decisions
- behavior concentration / ownership
- contracts / boundaries
- access / validation
- side effects / state / read models
- verification
- full draft

Show only the changed or decision-relevant slice unless the user asks for the
full PRD.

### 7. Persist and hand off

If the project defines durable artifact locations, do not claim completion until
those writes succeed.

If the project defines an implementation handoff artifact, write it after the
PRD is approved.

Then hand off according to the repo workflow:
- print the exact next command, not just the skill name
- include issue ID, task key, and flags when known
- use decomposition skill such as `/skill:taskify <id> --from plan` when the
  repo uses one
- otherwise use the exact coding handoff such as `/skill:code <id>` or
  `/skill:code <id> <task-key>` when recoverable
- or present the approved next step if the repo is conversation-only

## Rules

- Keep the PRD behavioral, not patch-oriented.
- Prefer narrow, evidence-backed research over broad scouting.
- Batch only blocking user decisions.
- Include concrete scenarios that could become tests.
- Include an explicit verification contract.
- During research, explicitly scan for existing duplicated or scattered
  business behavior. Name likely canonical owners and avoid introducing a
  second authority for an existing rule without saying so.
- Do not invent project artifact names, issue commands, or handoff steps; infer
  them from project docs or ask.
- Never say only `/skill:taskify` or `/skill:code` when the exact routed
  command is recoverable.
