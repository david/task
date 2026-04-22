---
name: 04-closed-state-and-rebuildable-projections
role: backend
depends_on: [01-esther-repo-local-core, 02-parent-child-hierarchy-queries, 03-phase-and-store-revision-lifecycle]
---

# 04: Closed-state handling and rebuildable read models

## Goal

Implement `IssueClosed` plus resilient read-model rebuild behavior so closing an issue appends history instead of moving directories and normal CLI reads recover automatically when derived `.task` indexes/materializations are missing or stale.

## Context

The PRD explicitly removes archive moves as the mechanism for closed issues. After this task:

- `task close <id>` appends `IssueClosed` and becomes idempotent
- closed issues remain addressable in-place through the hierarchy and search/list/show paths
- `list --all`, `show`, relationship commands, and search must surface closed issues from current state instead of archive directories
- current-state indexes, hierarchy views, and visible store materializations are rebuildable projections only
- canonical event files win if a projection/index/materialization disagrees or is missing

This task should make the CLI resilient to deleted/corrupt derived state by rebuilding from canonical history on demand or before serving the read.

## Repo Constraint

- Make implementation changes under `src/` only for this issue.
- Leave legacy top-level files alone unless a later task explicitly requires touching them.

## Files

- `src/commands.ts` — modify: change `close` away from archive moves and ensure read commands use rebuild-capable tracker helpers.
- `src/commands.test.ts` — modify: add close/readback scenarios and projection-rebuild scenarios that delete or corrupt derived `.task` files before reading.
- `src/tracker/events.ts` — modify: add `IssueClosed` folding and any closed-state projector hooks needed by current issue state.
- `src/tracker/projections.ts` — create: centralize rebuild/update logic for current issue state, hierarchy indexes, search indexes, and current store materialization from canonical events.
- `src/tracker/issues.ts` — modify: serve reads through the rebuildable projection layer and make `close` idempotent.
- `src/doc/architecture.md` — modify: document that projections/materializations are rebuildable and non-authoritative.
- `src/doc/commands.md` — modify: document that `close` no longer archives directories and that `--all` now means include closed issues from current state.

## TDD Sequence

1. Write a failing scenario test that closes an issue and then exercises `show`, `list --all`, and a relationship query involving that issue.
2. Write a failing rebuild test that creates issues/store data, deletes or corrupts derived `.task` indexes/materializations, and then reads through normal CLI commands.
3. Implement `IssueClosed` append logic and current-state folding for closed issues.
4. Implement projection/index rebuild-on-read behavior with canonical history as the authority.
5. Re-run the new scenario tests plus the earlier create/hierarchy/store suites.
6. Run quality gates: `bun test` and `bun run typecheck`.

## Verification Tests (from test plan)

### Closing an issue updates visible state without depending on archive moves
- **Setup**: Create an issue that participates in hierarchy or search results.
- **Action**: Run `task close <id>`, then `task show`, `task list --all`, and a relationship query involving that issue.
- **Assert**: The issue remains addressable, reports `status: closed`, and still participates correctly in relationship lookups; the close is represented by event history rather than a directory move.
- **Bug caught**: close appends history but read models or relationship queries stop surfacing the issue correctly.

### CLI reads rebuild correctly when projections or indexes are stale
- **Setup**: Create issues and store content, then delete or corrupt rebuildable `.task` indexes/materializations while leaving canonical event files intact.
- **Action**: Run normal read commands such as `task show`, `task list`, `task children`, or `task store get`.
- **Assert**: Commands return correct current state and recreate the missing/corrupt derived files from canonical history.
- **Bug caught**: reads that trust stale projections over the event log, or missing rebuild wiring in user-facing commands.

## Out of Scope

- legacy migration/import
- new feature work beyond closed-state and rebuild resilience
- changing the phase/store semantics already delivered in task 03

## Done When

- [ ] `task close` appends `IssueClosed` and is idempotent
- [ ] Closed issues remain visible through normal read/relationship flows
- [ ] Derived `.task` state rebuilds from canonical event history when missing or stale
- [ ] Docs updated to describe non-authoritative projections and non-archive close behavior
- [ ] Quality gates pass (`bun test`, `bun run typecheck`)
