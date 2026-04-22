# Scannable Output

Use this reference when the user needs to read plans, reviews, diagnoses, or
questions quickly.

## Core rule

Optimize for scanability first, depth second.
Do not hide detail, but do not lead with walls of text.
Present information progressively in stages unless the user asks for the full draft at once.

## Staged delivery

Default to progressive disclosure instead of dumping the full plan immediately.
Use a stable stage order so the user learns where to look next.

### Stage 1 — Orientation
Show only:
- `## At a Glance`
- `## Questions for You` when blocking decisions remain
- `## Defaults I Will Use`
- one-line `Next handoff`
- one-line `Next views available`

Goal: let the user answer or redirect quickly.

### Stage 2 — Focused review
After the user answers or asks for more, show only the next relevant slice.
Use the canonical slice order for the current mode whenever possible.

Canonical slice order:
- feature: `events -> boundaries -> auth/access -> validation -> automations -> read models -> migration/replay -> invariants -> observability -> verification -> full draft`
- debug: `root cause -> auth/access -> event impact -> contract impact -> validation gap -> side effects -> read models -> replay/compatibility -> broken invariant -> diagnostics gap -> fix plan -> verification -> full diagnosis`
- refactor: `structure -> preserved contracts -> preserved access semantics -> preserved side effects -> preserved read model behavior -> preserved replay compatibility -> preserved invariants -> preserved diagnostics -> characterization tests -> sequencing -> verification -> full plan`

Do not include unrelated deep detail in the same turn unless the user asks.

### Stage 3 — Draft review
Once the design is mostly aligned, present the draft artifact with:
- top summary sections first
- then only the sections that changed, are controversial, or still need approval

### Stage 4 — Full artifact / evidence
Show the full draft, full diagnosis, full refactor plan, or deep evidence trail only when:
- the user asks for it
- approval requires reviewing the full artifact
- or the omitted detail would change the recommendation

After stages 1–3, pause when useful instead of answering every possible question at once.

## User-facing response format

When interacting with the user, prefer this order:

### 1. At a Glance
Start with a compact table or bullet list that fits on one screen.

Recommended table:

| Topic | Value |
|---|---|
| Mode | `<feature|debug|refactor>` |
| Current view | `<one sentence>` |
| Biggest change / risk | `<one sentence>` |
| What I need from you | `<decision count or none>` |
| Next step | `<one sentence>` |

### 2. Questions for You
Ask only blocking questions.
Use a numbered list.
For each question, include:
- the question itself
- a recommended default
- why it matters in one short clause

Example:

1. **Should this be a new event or `V2` of the old event?**
   - **Recommended:** `V2`
   - **Why it matters:** payload meaning changes and replay must stay explicit.

If there are no blocking questions, say so explicitly.

### 3. Defaults I Will Use
When details are non-blocking, list defaults briefly instead of asking.

### 4. Details
Put the long-form reasoning, supporting evidence, and exact shapes after the
summary and questions.
Include only the detail relevant to the current stage unless the user asks for the full artifact.

### 5. Next handoff
When the workflow transition is known, print the exact next command.
Do not name only the skill.
Include the issue ID, task key, and required flags when those are known.

Examples:
- `Next handoff after approval: /skill:taskify gh549 --from plan`
- `Next handoff after diagnosis approval: /skill:taskify gh549 --from plan`
- `Next handoff: /skill:code gh549 01-fix-owner-resolution`

If the exact command is not yet safe, say what is missing instead of guessing.
Examples:
- `Next handoff after approval: blocked until an issue exists`
- `Next handoff: wait for decision 2 before choosing between /skill:feature <id> and /skill:refactor <id>`

### 6. Next views available
End staged responses with a short ordered menu that matches the canonical slice order.

Rules:
- show only the next 2–4 most relevant remaining slices
- start from the current frontier, not from the beginning every time
- do not print the full canonical chain unless the user asks for the full map
- include `full draft`, `full diagnosis`, or `full plan` only when that is a realistic next pull

Examples:
- early feature review: `Next views available: events -> boundaries -> auth/access -> full draft`
- mid feature review: `Next views available: validation -> automations -> read models -> verification`
- early debug review: `Next views available: root cause -> contract impact -> validation gap -> fix plan`
- refactor review after structure is aligned: `Next views available: preserved contracts -> sequencing -> verification -> full plan`

This helps the user pull the next layer instead of receiving everything at once.

## Artifact format

For plans, specs, diagnoses, and refactor plans, put a summary section before
all detailed sections.

### Required top sections

```md
## At a Glance
## Decisions Needed
## Changed Since Last Draft
```

Rules:
- `## At a Glance` is always first after the title.
- `## Decisions Needed` comes next. If none, write `None.`
- `## Changed Since Last Draft` is optional on first draft, required on revisions.

### At a Glance content

Prefer a compact table such as:

| Topic | Value |
|---|---|
| Recommendation | `<one line>` |
| Events | `<count and high-signal summary>` |
| Requests / Responses | `<count and high-signal summary>` |
| Validation | `<main validation changes>` |
| Blockers | `<none or short list>` |

Do not mirror every deep section in the top table.
Prefer these scanability rules:
- show rows for the changed or decision-relevant areas first
- collapse unchanged material into `same` or a short `Stable areas` row when helpful
- keep the top table useful for approval, not exhaustive for implementation

### Decisions Needed content

Use a compact table:

| # | Decision | Options | Recommended | Why it matters |
|---|---|---|---|---|
| 1 | `<decision>` | `<A / B / C>` | `<option>` | `<one line>` |

If none, write:

```md
## Decisions Needed
None.
```

### Changed Since Last Draft content

When revising, show only deltas:

| Area | Change |
|---|---|
| Events | `+DocumentSignedV2` |
| Requests | `validated(email)` |

## Artifact staging rules

For user-visible draft reviews:
- first show `## At a Glance`, `## Decisions Needed`, and `## Changed Since Last Draft`
- then show only the next section in the canonical slice order that is still decision-relevant
- advertise only the next 2–4 likely follow-up slices in `Next views available`
- keep the remaining sections in reserve for the next turn unless the user asks for the whole artifact

For revisions:
- first show only what changed
- then show the specific section that needs confirmation
- avoid re-sending unchanged sections unless the user asks

## Writing rules

- In staged review, do not resend unchanged deep sections unless they are needed for the current decision.

- Keep paragraphs short; prefer bullets or tables for comparisons.
- Keep bullets to one idea each.
- Lead with conclusions, not chronology.
- Use stable section order across iterations.
- Put exact shapes immediately under the relevant summary section, not far away.
- When a section has no change, write `same` or `None.` explicitly.
- Avoid repeating the same explanation in multiple sections.
- Use headings that answer the reader's question directly.

## Question-asking rules

- Ask no more than 3 blocking questions in one turn unless the user asks for a full questionnaire.
- Prefer multiple-choice or yes/no framing over open-ended prompts.
- Separate blocking questions from non-blocking defaults.
- If a recommendation exists, state it.

## Review / revision rules

When showing a revised plan, lead with:
1. what changed
2. what still needs approval
3. what stayed the same

The user should be able to answer from the top section without reading the whole document unless they want the detail.

When the review is interactive, prefer this sequence:
1. summary + decisions
2. changed section only
3. full artifact on request or final approval
