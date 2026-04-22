## Root cause
The canonical QA failure for `qa-03-invalid-paths-and-help-surface` was real when it was recorded, but it is no longer reproducible on the current branch.

The original mismatch was the same one captured in `research:diagnosis`:
- the repo-root entrypoint and root docs still exposed the legacy `store` surface
- the staged `src/` entrypoint had already moved to `set|get|delete --key <path>`

That mismatch has since been repaired on this branch:
- `7ab546e fix(cli): align root task entrypoint with document surface`
- `6deb947 docs: align supported issue document docs`
- `f9a9f73 test: remove unsafe root cli stdout casts` (follow-up verification cleanup)

Current evidence:
- `bun task.ts --help` now advertises `set`, `get`, and `delete`, and does not show `store set|get|keys|delete`.
- `bun src/task.ts --help` mirrors the same surface.
- `doc/commands.md`, `doc/project-management.md`, `doc/architecture.md`, `src/doc/commands.md`, `src/doc/project-management.md`, and `src/doc/architecture.md` now describe the path-based document model rather than `task store ...`.
- The invalid-path cases from QA still fail clearly:
  - `/research` → `{"error":"Invalid document key '/research'"}`
  - `research//today` → `{"error":"Invalid document key 'research//today'"}`
  - `research/../today` → `{"error":"Invalid document key 'research/../today'"}`

So the remaining failure is not an active code defect on HEAD. The stale signal is the persisted QA artifact:
- `task-status:qa-03-invalid-paths-and-help-surface = failed:inconsistent command surface`
- `qa-results:qa-03-invalid-paths-and-help-surface` still reflects the pre-fix run from `2026-04-21T14:38:00Z`

## Regression history
Timeline:
- `2026-04-21T14:38:00Z` — QA recorded the failure against the earlier branch state.
- `run-007` — root `task.ts` was switched to the shared `src/commands-registry` surface and root CLI regressions were added.
- `run-008` — supported root/staged docs were updated and doc parity regression coverage was added.
- `run-009` — full verification reran and passed, including explicit help/doc/invalid-path checks.

The regression itself has already been fixed; what remains is a stale QA result that predates the repair.

## Prior issue history
This issue already contains:
- `research:diagnosis` — original root-cause analysis of the split root-vs-src surface
- `research:plan` — approved repair plan
- `research:retro-invalid-help-surface` — retrospective noting staged-surface drift and missing parity coverage
- `code-history:run-007` / `run-008` / `run-009` — implementation and verification records for the fix

## What we learned then
The original diagnosis was correct: root CLI parity and supported-doc parity both had to be treated as part of the user-facing contract, not as optional follow-up cleanup.

## Why that learning didn't stick
The code repair did stick. What did not stick is workflow state hygiene:
- QA failure artifacts are append-only and remained in place after later repair work landed.
- The issue still presents a failed QA signal until someone reruns the QA task and records a fresh result.

## Why does this keep happening?
This is a workflow visibility problem more than a code problem:
- QA artifacts capture a point-in-time failure.
- Later implementation runs can fix the defect without automatically invalidating or superseding the old QA result.
- Without an explicit rerun, the issue can look actively broken even when HEAD is healthy.

## Proposed fix
No new code change is indicated by the current evidence.

Next action should be:
1. Re-run `qa-03-invalid-paths-and-help-surface` on the current branch state.
2. If it passes, replace the stale QA result with a fresh passing record and update task status accordingly.
3. Only reopen code investigation if the rerun finds a new, current repro that differs from the historical one.

## Why was this undetected?
Because the workflow still surfaces the historical failed QA artifact even after the repair commits and full automated verification passed. The branch was fixed, but the QA result was never refreshed.

## Verification Contract
### Setup / Preconditions
- Use the current branch containing commits `7ab546e`, `6deb947`, and `f9a9f73`.
- Run QA against the supported repo-root surface (`bun task.ts`) and the supported docs under `doc/` and `src/doc/`.

### User-Observable Proof
- `bun task.ts --help` shows `set`, `get`, and `delete`, not legacy `store` commands.
- Invalid document key paths still fail clearly.
- Supported docs consistently describe the path-based document model.

### Automated Proof
- `bun test task.test.ts src/task.test.ts`
- `bun test`
- `bun run typecheck`
- Optional targeted grep: `rg -n "task store|store set|store get|store keys|store delete|bun src/task.ts|src/bin/task" doc src/doc`

### Fast Recheck
- `bun task.ts --help`
- `bun src/task.ts --help`
- invalid-path smoke checks for `/research`, `research//today`, and `research/../today`
- `task.test.ts` supported-doc parity test

## Manual QA Intent
Re-run QA-03 exactly as written, but on the current branch head rather than the earlier pre-fix revision captured in the old result.

## Risk
Low. The main risk is procedural: accepting or acting on a stale failed QA artifact instead of re-validating the repaired branch state.

## Disposition
bugfix-now
