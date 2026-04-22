---
name: 03-phase-and-store-revision-lifecycle
role: backend
depends_on: [01-esther-repo-local-core]
---

# 03: Phase commands and phase-scoped store revisions

## Goal

Add workflow-aware `task phase` commands plus append-only store revision handling so phase changes validate against `.task/settings.json`, finalize current drafts implicitly, and later store edits create new revisions instead of mutating finalized artifacts.

## Context

This is the heart of the intentional workflow change in the PRD:

- `phase` stops being a generic `meta set` key and becomes a first-class command path
- `.task/settings.json` defines the default phase, allowed phases, and transition graph
- `task phase next <id>` returns the configured next phase
- `task phase set <id> --value <phase>` appends `IssuePhaseChanged` and finalizes all open store drafts for that issue in the same logical transition
- `task store set/get/keys/delete` operate on append-only revision history, while the visible store view shows the latest current content
- issue-local writes must use Esther optimistic-concurrency preconditions via `expectedPosition` and `boundaryTags: ["issue:<id>"]`
- reserved metadata keys include `status`, `phase`, and `parentId`; `meta set` must stop mutating them directly

Keep command output machine-readable. Prefer a small settings parser/validator and a focused store-revision helper module rather than pushing more branching into `commands.ts`.

## Repo Constraint

- Make implementation changes under `src/` only for this issue.
- Leave legacy top-level files alone unless a later task explicitly requires touching them.

## Files

- `src/commands.ts` — modify: register `phase set` and `phase next`; block reserved keys in `meta set`; route store commands through revision-aware helpers.
- `src/commands.test.ts` — modify: add integration coverage for configured phase transitions, implicit finalization, later-phase edits, reserved-key rejection, and stale-write concurrency failures.
- `src/task.ts` — modify: include the new `phase` commands in help/examples and remove examples that imply `meta set` is the normal phase-transition path.
- `src/tracker/settings.ts` — create: read/validate `.task/settings.json`, provide default phase/next-phase/transition helpers, and define the minimal on-disk config schema you introduce.
- `src/tracker/stores.ts` — create: implement `StoreRevisionSaved`, `StoreRevisionFinalized`, delete events, revision numbering, and current store materialization.
- `src/tracker/events.ts` — modify: add schemas/folding for phase and store events plus reserved metadata handling.
- `src/tracker/issues.ts` — modify: wire issue-local writes through `queryByTags(...).maxPosition` + `append(..., { expectedPosition, boundaryTags })`.
- `src/doc/commands.md` — modify: document `task phase next`, `task phase set`, and the new store lifecycle behavior.
- `src/doc/project-management.md` — modify: note that phase changes are explicit commands and that store artifacts become finalized on phase transition.

## TDD Sequence

1. Write a failing integration test for `.task/settings.json`-driven `phase next` and `phase set`, including an invalid transition case.
2. Write a failing integration test that saves draft store entries, advances the phase, and inspects canonical history for `StoreRevisionFinalized` events.
3. Write a failing integration test that edits the same store key in a later phase and proves a new revision is created without mutating the finalized one.
4. Write a failing stale-writer test that reuses an old `maxPosition` and expects a concurrency error.
5. Implement settings parsing, reserved-key enforcement, phase commands, store revision helpers, and issue-local optimistic concurrency wiring.
6. Re-run the new integration tests and the earlier create/show/list/search coverage.
7. Run quality gates: `bun test` and `bun run typecheck`.

## Verification Tests (from test plan)

### Phase commands honor `.task/settings.json`
- **Setup**: Configure `.task/settings.json` with a non-trivial phase graph and create an issue in the default phase.
- **Action**: Run `task phase next <id>`, then `task phase set <id> --value <allowed-next>`, then attempt an invalid transition.
- **Assert**: `phase next` returns the configured next phase, `show` reports the new phase after the valid transition, and the invalid transition fails with a clear error.
- **Bug caught**: one code path reading config while another hardcodes workflow rules, or transition validation being bypassed.

### Phase change finalizes all open store drafts for that issue
- **Setup**: Create an issue, save one or more store entries in its current phase, and leave them as drafts.
- **Action**: Advance the issue with `task phase set`.
- **Assert**: The phase changes, current store content stays visible, and canonical history contains one `StoreRevisionFinalized` per open draft key on that issue.
- **Bug caught**: transitions that move the issue forward but skip the implicit finalization step.

### Editing the same store key in a later phase creates a new revision instead of mutating finalized content
- **Setup**: Start from an issue with a finalized store entry from an earlier phase.
- **Action**: Run `task store set` for the same store/key in the new phase, then inspect current output and canonical event history.
- **Assert**: `task store get` shows the new content while canonical history still contains the earlier finalized revision and a new later-phase revision with a higher revision number.
- **Bug caught**: silent mutation of finalized artifacts or loss of revision history.

### Stale issue writes fail with optimistic-concurrency errors
- **Setup**: Read an issue’s current state/position, then perform one successful write to that same issue boundary.
- **Action**: Attempt a second write using the stale read as its basis.
- **Assert**: The second write fails with a concurrency error and visible state remains the first successful write.
- **Bug caught**: command handlers that forgot to pass `expectedPosition` or `boundaryTags`.

## Out of Scope

- parent/child hierarchy commands
- close semantics and closed-issue visibility
- projection rebuild after index/materialization loss
- legacy migration/import

## Done When

- [ ] `task phase next` and `task phase set` exist and read `.task/settings.json`
- [ ] `meta set` rejects reserved keys (`status`, `phase`, `parentId`)
- [ ] Store commands use append-only revision history with implicit finalization on phase change
- [ ] Issue-local writes enforce optimistic concurrency through Esther preconditions
- [ ] Docs/help updated for the new workflow path
- [ ] Quality gates pass (`bun test`, `bun run typecheck`)
