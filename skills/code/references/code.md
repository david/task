# Code — Repeatable Foreground Implementation & Verification

Implement one focused slice of approved work in the foreground.

Adapt this skill to the repo before acting:
- read `AGENTS.md`, `CLAUDE.md`, package scripts, and workflow docs
- read `doc/task-workflow.md` when it exists
- read `doc/coding.md` when it exists
- infer whether the repo uses issue-backed artifacts, task graphs, run-history
  records, or plain conversation mode
- follow repo docs when they define a more specific coding workflow

## Entry contract

A tracked run should have:
- an issue ID or unambiguous issue-backed work item in context
- an approved handoff artifact, runnable task, or clearly scoped repair slice
- a clean git tree

In this package's standard workflow, `/skill:code` is issue-backed and task-backed.
Do not fall back to conversation-only coding unless the user explicitly overrides the workflow.

## Session boundary discipline

Tracked `/skill:code` runs are intentionally short-lived:
- implement exactly one runnable slice per session
- verify it before moving on
- commit or discard incomplete work before returning
- if another runnable coding slice remains and `next_session` is available,
  invoke it with the exact next `/skill:code ...` command
- do not automatically continue into `/skill:check`, `/skill:qa`, or deploy

## Shared setup

### 1. Inspect repo state

Run:

```bash
git status --short
git diff --stat
```

If the tree is dirty, stop unless the user explicitly asked you to continue from
that state.

### 2. Load durable context when the repo defines it

Read the approved plan, current task graph, prior run history, latest failing
check/report, or equivalent project artifacts when they exist.
In the standard task-backed workflow, this normally means:
- `research/plan`
- `tasks/*`
- `task-status/*`
- `code-history/*`
- `taskify-history/*`
- optional `check-report/*`

Summarize before coding:
- what prior runs changed
- what they verified
- what remains open
- what the current run should accomplish

### 3. Frame the run before wider exploration

State:
- mode: task/decomposition mode, approved-plan mode, repair mode, or ad-hoc mode
- active task or slice
- likely starting files / tests / commands
- strongest current implementation hypothesis
- intended proof

Start from the narrowest useful entrypoint.

### 4. Implement the slice

Honor the current approved scope.
If the repo provides task files with likely files, counterpart surfaces, or
verification notes, use them as strong starting hints.

Prefer TDD when practical:
1. add/update the test
2. confirm it fails for the right reason
3. implement the change
4. rerun the targeted proof

### 5. Verification sequence

A coding run is not complete until the applicable checks pass:
1. targeted tests or narrow proof for the slice
2. project lint command(s)
3. repo-specific diff lint or custom lint when the workflow defines one
4. project typecheck command(s)
5. observable verification from the approved handoff when applicable
6. your own diff review against scope and out-of-scope guardrails

### 6. Persist and hand off

When the repo defines run-history records, append a new one and refresh any
pointer document before returning. In the standard task-backed workflow, write:
- `code-history/run-00N`
- `code-history/latest`

Also update `task-status/<task-key>` when the active task succeeds or fails.

A useful run record captures:
- what changed
- what was verified
- commits created
- remaining work or blockers
- the exact next command

Before returning, use `/skill:commit` for the commit pass when the harness makes
that skill available. In task-backed repos, that commit pass must include the
related `.task/` changes in the same logical commit as the code/docs they
describe.

On success:
- mark the active task done when the repo tracks task status
- do not consider the slice complete until the related `.task/` updates are committed
- queue the next runnable `/skill:code ...` command with `next_session` when
  available and more coding work remains
- otherwise hand off to the repo's confirmation step, normally
  `/skill:check --issue <id>` in this task-backed workflow

On failure:
- preserve any completed verified slice worth keeping
- discard incomplete WIP
- keep the tree clean
- hand off to the appropriate next step (another code run, decomposition,
  diagnosis, or explicit blocker)

## Rules

- Foreground only.
- One tracked run equals one runnable slice.
- Never return from tracked coding with a dirty tree.
- In this package's standard workflow, prefer the canonical task-backed artifact names from `doc/task-workflow.md` over ad hoc alternatives.
- Do not invent artifact names, task-status paths, or report formats; infer them
  from project docs or ask when they are genuinely ambiguous.
