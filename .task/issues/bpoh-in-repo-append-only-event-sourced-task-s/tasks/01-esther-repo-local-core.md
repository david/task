---
name: 01-esther-repo-local-core
role: backend
depends_on: []
---

# 01: Esther-backed repo-local tracker core

## Goal

Replace the legacy global `~/.local/share/issues` backing store for the core create/read/search flows with a repo-local `.task/` tracker backed by Esther’s filesystem event store, while preserving the current JSON command contracts where the PRD does not intentionally change them.

## Context

`commands.ts` currently reads and writes mutable issue directories directly under a global root. The approved PRD changes the source of truth to canonical Esther event files under `.task/` inside the current repo. Start by making the core tracker boundary real:

- resolve tracker state from the repo being operated in, not from the user home directory
- bootstrap the repo-local `.task/` layout and Esther store/checkpoint handles
- define task domain event schemas/folding helpers for current issue state
- move command-side storage logic behind small tracker helpers instead of expanding the current monolith further

This task should make `task create`, `task show`, `task list`, and `task search` work against the new event-backed source of truth. It does **not** need parent/child hierarchy, phase commands, versioned store revisions, close semantics, or migration yet.

The Esther adapter already exists in `packages/esther/src/adapters/filesystem/`; consume it from the root CLI rather than re-implementing append/query primitives.

## Files

- `commands.ts` — modify: route `create`, `show`, `list`, and `search` through new tracker helpers instead of direct `issue.json` directory access; keep command output shapes stable.
- `commands.test.ts` — modify: replace global-root assumptions for the covered commands with repo-local temp repos and add scenario coverage for `.task` event creation.
- `task.ts` — modify: keep help/examples accurate if any command wording changes while preserving argv/output behavior.
- `tracker/root.ts` — create: resolve the repo-local tracker root, bootstrap `.task/`, and centralize Esther store/checkpoint construction.
- `tracker/events.ts` — create: define the task event shapes/schemas and shared issue-fold helpers for current metadata.
- `tracker/issues.ts` — create: implement create/show/list/search reads and writes on top of `append(...)` and `queryByTags(...)`.
- `doc/architecture.md` — modify: document repo-local `.task/` storage and Esther-backed canonical history.
- `doc/commands.md` — modify: update command storage/location notes away from `~/.local/share/issues` for the covered commands.

## TDD Sequence

1. Write a failing scenario test that runs commands in two separate temp repos and proves state does not leak between them and does not read a seeded legacy global issue.
2. Write a failing scenario test that creates an issue, then exercises `show`, `list`, and `search` against the event-backed repo-local tracker.
3. Implement tracker-root resolution plus Esther event-store wiring.
4. Implement core issue event folding and command helpers for create/show/list/search.
5. Re-run the new scenario tests, then the existing command/test suites those commands touch.
6. Run quality gates: `bun test` and `bun run typecheck`.

## Verification Tests (from test plan)

### Repo-local tracker isolation
- **Setup**: Create two temp repos with different working directories and seed one legacy global issue outside them.
- **Action**: Run `task create` + `task list` in repo A, then `task list` in repo B.
- **Assert**: Repo A sees only its own `.task` data, repo B stays empty, the seeded legacy issue is ignored, and canonical event files appear under repo A’s `.task` tree.
- **Bug caught**: accidental continued use of `~/.local/share/issues` or cross-repo state leakage.

### Create issue is visible through normal reads
- **Setup**: In a clean temp repo, create an issue with title/description/labels/priority/github metadata.
- **Action**: Run `task show`, `task list`, and `task search` for that issue.
- **Assert**: Returned fields match the created issue and canonical event files exist for the issue.
- **Bug caught**: append succeeds but current-state reads still come from legacy mutable files or stale assumptions.

## Out of Scope

- `create --parent`, hierarchy projections, or relationship commands
- phase configuration or `task phase ...`
- versioned store revisions/finalization
- closing issues via `IssueClosed`
- legacy migration/import

## Done When

- [ ] Failing repo-local scenario tests were added first
- [ ] `task create`, `show`, `list`, and `search` run against repo-local Esther-backed state
- [ ] Canonical event files under `.task/` are the source of truth for these flows
- [ ] Help/docs updated for the new storage location
- [ ] Quality gates pass (`bun test`, `bun run typecheck`)
