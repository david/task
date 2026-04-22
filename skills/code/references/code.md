# Code — Repeatable Foreground Implementation & Verification

Implement one focused slice of approved work in the foreground.

Adapt this skill to the repo before acting:
- read `AGENTS.md`, `CLAUDE.md`, package scripts, and workflow docs
- infer whether the repo uses issue-backed artifacts, task graphs, run-history
  records, or plain conversation mode
- if a project-local override exists, follow it

## Entry contract

A tracked run should have, as applicable:
- an issue or approved work item in context
- an approved handoff artifact, runnable task, or clearly scoped repair slice
- a clean git tree

If the repo has no durable workflow, fall back to direct conversation-backed
implementation with the same one-slice-per-session discipline.

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
pointer document before returning.

A useful run record captures:
- what changed
- what was verified
- commits created
- remaining work or blockers
- the exact next command

On success:
- mark the active task done when the repo tracks task status
- queue the next runnable `/skill:code ...` command with `next_session` when
  available and more coding work remains
- otherwise hand off to the repo's confirmation step, typically `/skill:check`

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
- Do not invent artifact names, task-status paths, or report formats; infer them
  from project docs or ask.
