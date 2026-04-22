---
kind: debug
approved_from: research:diagnosis
status: approved
---

# Approved Plan

## Scope
Repair the user-facing command/documentation surface for issue documents so the repo-root CLI entrypoint and supported docs consistently advertise the approved path-based `task set|get|delete --key <path>` model.

## Root Cause
The path-based document work only updated the staged `src/` CLI. The repo-root `task.ts` / `commands.ts` surface and multiple docs still expose the legacy `task store ...` contract, so help and docs disagree about the supported workflow.

## Proposed Fix
- Unify the repo-root CLI surface with the staged `src/` document-command surface, preferably by delegating the root entrypoint to the `src/` registry rather than maintaining two independent command surfaces.
- Remove legacy `store` help/registration from the supported repo-root surface.
- Update supported docs in `doc/` and `src/doc/` to describe issue documents via `set/get/delete --key <path>`, including entrypoint guidance and examples.
- Add regression coverage for repo-root help output and doc/help parity so legacy `store` strings do not silently return.

## Source Artifacts
- primary: `research:diagnosis`
- supporting: `research:prd`

## Verification Contract
### Setup / Preconditions
- Run from the repo root.
- Use one disposable issue for document-command smoke checks.

### User-Observable Proof
- `bun task.ts --help` shows `set/get/delete` and not `store set|get|keys|delete`.
- Supported docs no longer instruct users to use `task store ...` for attached documents.
- Invalid-path rejection examples still fail clearly.

### Automated Proof
- Repo-root help regression coverage
- Documentation parity/regression coverage for supported command docs
- `bun test`
- `bun run typecheck`

### Fast Recheck
- `bun task.ts --help`
- `bun src/task.ts --help` (if retained)
- `rg -n "task store|bun task.ts|bin/task" doc src/doc`

## Out of Scope
- Changing the underlying path-validation behavior that already passes QA.
- Redesigning the document event/projection model.
- Preserving the legacy `task store ...` surface as a supported compatibility alias.
