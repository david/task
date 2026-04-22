# Scoped Discovery

Use this reference for planning-heavy or investigation-heavy work where the right outcome depends on understanding the problem clearly before widening repo exploration.

Typical users:
- `/skill:feature`
- `/skill:debug`
- `/skill:refactor`
- plan-only requests
- investigations, audits, and root-cause analysis

See also:
- `decision-batching.md` for reducing conversational sprawl once discovery turns into planning or clarification

## Purpose

Optimize for a useful early synthesis, not exhaustive repository coverage.

Default stance:
- start from the named source of truth
- inspect the smallest set of code paths that can answer the current question
- draft early
- expand only to close specific gaps

A good first draft with explicit unknowns is usually better than a broad repo tour.

## When to apply it

Apply this workflow when the task is primarily about:
- scoping a feature or producing a PRD / implementation plan
- diagnosing a bug or QA failure
- planning a behavior-preserving refactor
- understanding an existing flow before deciding what to do

Do not treat this as a ban on deeper research. It is a default workflow for the early phase. If the task proves broader, say why and then widen the search deliberately.

## Default workflow

### 1. Read the source of truth first

Start with the narrowest authoritative artifact available:
- issue / task record
- stored research artifact
- spec / PRD / diagnosis / refactor plan
- failing test / stack trace / QA artifact
- user-provided file, route, command, or repro

Do not begin with a broad repo scan when a sharper starting point already exists.

### 2. Read only the minimum boundary docs needed

Read only the docs needed to avoid category mistakes:
- architecture / conventions
- workflow or testing docs
- boundary or ownership rules

Do not read every adjacent doc unless the task actually depends on them.

### 3. Search for primary entry points

Search for the most relevant:
- symbols
- routes
- tables
- aggregates
- slices / handlers / stores
- test names

Use search to build a candidate set. Then inspect the highest-leverage files first.

### 4. Inspect representative files first

Prefer representative files over neighboring-file sweeps.

Start with files most likely to answer:
- where the behavior begins
- where state is written
- where state is rendered / projected
- where public schemas or contracts are defined
- where current tests already describe the behavior

Do not read whole clusters of adjacent files "just in case."

### 5. Stop and synthesize early

After the first pass, write a short synthesis before continuing.

Capture:
- source of truth used
- task mode: feature planning, diagnosis, refactor planning, or investigation-only
- current understanding of the problem
- top files / surfaces likely involved
- strongest current hypothesis
- biggest risks or uncertainties
- exact open questions
- next action and verification plan

Use that synthesis to decide whether more exploration is necessary.

### 6. Make an explicit decision checkpoint

After the first synthesis, do not continue with open-ended reconnaissance.
Choose one of these explicitly:
- **edit / draft** — when the likely target is visible and the next useful step is to write the plan, diagnosis, or code-adjacent artifact
- **ask one blocking question** — when a user decision materially changes scope, architecture, or verification
- **summarize findings** — when the investigation answered the question without needing more work
- **declare blocker** — when a specific missing artifact, repro, permission, or runtime signal prevents further progress

Repeated rereads, repeated help lookups, or continued scanning without a sharper hypothesis are warning signals that this checkpoint is overdue.

### 7. Expand only to close named gaps

If something is still unclear, name the gap first, then read only what is needed to close it.

Good examples:
- "I know the write path but not the render path."
- "I found the route but not the DB projection that feeds it."
- "I know the failing component but not where the session state is derived."

Bad example:
- "I should probably read more surrounding files."

## Exploration budget

Before producing the first synthesis or draft, prefer to stay within roughly:
- <= 25 tool calls
- <= 15 files read
- <= 10 implementation files

This is a heuristic, not a hard cap.

Pause and synthesize before continuing when any of these happen:
- you exceed the budget above
- you reread the same file or doc without a new question
- you repeat help or documentation lookups without a narrower follow-up hypothesis
- you still cannot name the likely target file, test, route, or artifact
- you are about to read "surrounding" files without a named gap

At that pause, state:
- what is already known
- what remains unknown
- the strongest current hypothesis
- which exact additional files are required
- whether the next action is `edit`, `ask`, `summarize`, or `block`

## Anti-patterns

Avoid these unless you can state why they are necessary:
- exhaustive repo tours for plan-only or diagnosis-first work
- reading neighboring files without a concrete question
- rereading the same file without a new reason
- broad test sweeps before the core implementation path is known
- collecting implementation detail long before the problem is framed

## Deliverable expectations

### For `/skill:feature`
A good draft should identify:
- the user-visible goal
- the likely event / command / view surfaces involved
- key constraints and risks
- open questions that still need user input

### For `/skill:debug`
A good draft should identify:
- the observed symptom and repro
- the most likely failing path
- evidence for the root-cause candidate
- what specific unknown still blocks a confident diagnosis

### For `/skill:refactor`
A good draft should identify:
- the structural goal
- unchanged behavioral invariants
- likely files / boundaries to touch
- characterization or regression-proof needs

## Rule of thumb

Prefer:
- bounded first-pass discovery
- an early synthesis checkpoint
- explicit unknowns
- targeted follow-up reads

over:
- exhaustive early inspection
- broad neighboring-file scans
- repeated rereads without synthesis
- delaying the first draft until the repo feels "fully mapped"
