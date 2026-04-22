## Root cause
The repo still exposes two different CLI/documentation surfaces for issue-attached documents.

- `src/task.ts` and `src/commands-registry.ts` were updated to the approved `task set|get|delete --key <path>` model.
- The repo-root CLI (`task.ts` + `commands.ts`) still registers and advertises the legacy `task store set|get|keys|delete` family.
- The repo-root docs (`doc/commands.md`, `doc/project-management.md`, `doc/architecture.md`) and staged docs (`src/doc/commands.md`, `src/doc/project-management.md`) still describe the legacy store/key surface. `doc/commands.md` and `src/doc/commands.md` also still tell users to run `bun task.ts`, while the staged architecture doc says the active wrapper is `src/bin/task -> bun src/task.ts`.

So invalid-path validation works in the new `src/` entrypoint, but the overall user-facing surface is inconsistent because the default repo entrypoint and docs were never brought over to the new contract.

## Regression history
This is mostly a rollout-gap, not a fresh parser regression.

- `2fe0aa6 refactor(task): stage in-repo rewrite under src` introduced the split between the legacy repo-root CLI and the staged `src/` rewrite.
- `cfe90a7 feat(task): add document set/get/delete commands` updated the `src/` CLI surface to `set/get/delete`.
- `task.ts` has not been updated since the staging split, and `doc/commands.md` still comes from the pre-document-path surface.

The result is that the new behavior landed only in the staged entrypoint while the old public surface stayed intact.

## Prior issue history
`task search` / `task list --all --text` did not find an earlier tracked issue for this exact mismatch. The current issue `hz11` already contains the relevant product intent and QA task.

## What we learned then
The approved artifacts already called this out:

- `research:plan` / `research:prd` say the supported user-facing family is `task set`, `task get`, and `task delete`.
- The PRD explicitly lists “Preserving the old `task store ...` command family as a compatibility alias” as a non-goal.
- The manual QA intent explicitly says CLI help/examples should no longer expose `store`.

## Why that learning didn't stick
Task decomposition and implementation narrowed the work to the staged `src/` CLI only.

Evidence:
- task `02-document-command-surface` says “remove the `task store ...` command family from the in-progress `src/` CLI surface.”
- `code-history:run-001` says the run “switched the in-progress `src/` CLI surface” and updated `src/task.ts` tests.
- The task file did not include repo-root `task.ts`, `commands.ts`, or the authoritative root `doc/` docs.

So execution matched the narrowed task, but the narrowed task no longer matched the approved user-facing contract.

## Why does this keep happening?
The repo currently has duplicate surfaces with no parity guard:

- repo-root CLI/docs
- staged `src/` CLI/docs

Once those diverge, focused implementation and full automated gates can still pass if tests only exercise one surface. This is the same broader bug family as staged-rewrite drift: one entrypoint changes, the other keeps advertising old behavior.

## Proposed fix
Treat the repo-root entrypoint and root docs as part of the supported user-facing surface for this issue, and bring them into parity with the approved document-path model.

Minimum repair scope:
1. Replace the repo-root `task.ts` command/help surface so `bun task.ts --help` exposes the same `set/get/delete` model as `bun src/task.ts`.
2. Remove legacy `store` command registration/help from the repo-root CLI surface, or make the root entrypoint delegate directly to the `src/` CLI so there is only one public command registry.
3. Update user-facing docs that still instruct `task store ...` usage:
   - `doc/commands.md`
   - `doc/project-management.md`
   - `doc/architecture.md`
   - `src/doc/commands.md`
   - `src/doc/project-management.md`
4. Resolve entrypoint guidance consistently (`bun task.ts` vs `bun src/task.ts`, and the missing root `bin/task` reference).
5. Add regression coverage that exercises the repo-root help surface and guards against legacy `store` strings in the supported docs.

## Why was this undetected?
Automation covered the staged entrypoint, not the full user-facing surface.

- `src/task.test.ts` asserts that `bun src/task.ts --help` contains `set/get/delete` and does not contain `store`.
- The legacy root `task.test.ts` only checks generic help behavior and never asserts the document-command surface.
- No automated check validates `doc/` / `src/doc/` command examples against the approved CLI contract.
- `bun test` and `bun run typecheck` therefore passed even though QA steps 4-5 still failed.

## Verification Contract
### Setup / Preconditions
- Use the current branch with issue `hz11`.
- Have one disposable issue ID available for document-command smoke checks.
- Check both repo entrypoints (`bun task.ts` and, if retained, `bun src/task.ts`) plus the user-facing docs under `doc/` and `src/doc/`.

### User-Observable Proof
- `bun task.ts --help` advertises `set`, `get`, and `delete` and does not advertise `store set|get|keys|delete`.
- If `bun src/task.ts` remains a supported direct entrypoint, it shows the same command family and examples.
- `doc/commands.md` and the related project-management docs explain issue documents with `--key <path>` and no longer tell users to use `task store ...` for attached documents.
- Invalid document keys such as `/research`, `research//today`, and `research/../today` still fail with clear errors.

### Automated Proof
- Add/update root-entrypoint help tests so `bun task.ts --help` must contain `set/get/delete` and must not contain `store set|get|keys|delete`.
- Add/update documentation-oriented regression coverage (or a targeted text assertion test) for the supported command docs so legacy `task store ...` examples do not reappear.
- Rerun `bun test` and `bun run typecheck` for the full repo.

### Fast Recheck
- `bun task.ts --help`
- `bun src/task.ts --help` (if still supported)
- `rg -n "task store|bun task.ts|bin/task" doc src/doc`
- `bun test`
- `bun run typecheck`

## Manual QA Intent
- Re-run QA-03 exactly as written.
- Confirm invalid-path rejection still behaves the same.
- Confirm help/examples for every supported entrypoint describe the new document-path model consistently.
- Confirm docs do not reference missing wrappers or legacy store commands as the normal workflow.

## Risk
Medium. Aligning the repo-root entrypoint may touch the broad command registry/help surface, and doc cleanup spans both `doc/` and `src/doc/`. The main risk is accidentally changing unrelated legacy command semantics while removing duplicate surfaces. The safest repair is to reduce duplication rather than manually keep two independent command registries in sync.

## Disposition
bugfix-now
