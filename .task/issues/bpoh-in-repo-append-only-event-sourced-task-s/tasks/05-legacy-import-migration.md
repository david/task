---
name: 05-legacy-import-migration
role: backend
depends_on: [01-esther-repo-local-core, 02-parent-child-hierarchy-queries, 03-phase-and-store-revision-lifecycle, 04-closed-state-and-rebuildable-projections]
---

# 05: Legacy tracker import and migration

## Goal

Add the one-time migration path that imports legacy tracker data into the repo-local event-sourced `.task/` format by emitting normal task domain events and surfacing equivalent state through the new CLI.

## Context

The PRD’s rollout depends on migration support before dogfooding. The importer must:

- read legacy tracker data from the old layout
- emit normal task events (`IssueCreated`, `IssuePhaseChanged`, `IssueMetadataSet`, `IssueLabelsChanged`, `IssueRefsChanged`, `StoreRevisionSaved`, `StoreRevisionFinalized`, `IssueClosed`, plus `LegacyImportCompleted` if you keep that marker)
- preserve current visible metadata/store state and timestamps where possible
- infer parentage from exactly one local issue ref; leave zero-parent issues as roots; abort on more than one candidate parent with `ambiguous_legacy_parent`
- import legacy store files as finalized revision 1 in the issue’s current phase unless explicitly designed otherwise by the PRD
- leave canonical `.task` events as the only source the normal CLI reads afterward

Keep the migration entrypoint clearly separated from day-to-day issue commands. Use the existing two-word command style if you need to introduce a new CLI subcommand, and update help/docs/tests to match the final grammar you choose.

## Repo Constraint

- Make implementation changes under `src/` only for this issue.
- Leave legacy top-level files alone unless a later task explicitly requires touching them.

## Files

- `src/commands.ts` — modify: register the migration/import entrypoint and wire it to a dedicated importer helper.
- `src/commands.test.ts` — modify: add representative migration fixtures covering open/closed issues, stores, refs, and inferred hierarchy, plus the ambiguous-parent failure case.
- `src/task.ts` — modify: expose the migration command in help/examples if it is a public CLI path.
- `src/tracker/migrate.ts` — create: read legacy issue directories, translate them into domain events, enforce migration preconditions, and produce an import result/report.
- `src/tracker/issues.ts` / `src/tracker/stores.ts` / `src/tracker/hierarchy.ts` — modify as needed: support importer reuse of the normal event-writing/projector paths rather than a parallel representation.
- `src/doc/architecture.md` — modify: document the migration path and rollout ordering.
- `src/doc/commands.md` — modify: document the migration/import command and its safety constraints.

## TDD Sequence

1. Write a failing scenario test that builds a representative legacy fixture, runs the migration command, and then verifies the migrated issues through normal `show`, `list`, `children`, `parents`, `store get`, and search commands.
2. Write a failing integration test for the ambiguous-parent case and assert the exact `ambiguous_legacy_parent` error plus no successful imported state.
3. Implement the importer and route it through normal event-appending/projector code paths.
4. Re-run the migration scenarios plus the full read-model suite to confirm migrated state is indistinguishable from natively-created state.
5. Run quality gates: `bun test` and `bun run typecheck`.

## Verification Tests (from test plan)

### Legacy migration produces equivalent CLI-visible state in the new tracker
- **Setup**: Create a representative legacy tracker fixture with open and closed issues, store files, labels, refs, and at least one unambiguous parent inferred from a local ref.
- **Action**: Run the migration/import command, then query the migrated issues with `show`, `list`, `children`, `parents`, `store get`, and search commands.
- **Assert**: The migrated repo exposes the same current metadata and store contents through the new CLI, parent inference is preserved, closed issues remain closed, and canonical `.task` events exist for the imported state.
- **Bug caught**: importer writes events but fails to wire projections, hierarchy, or store materialization to those events.

### Ambiguous legacy parents abort migration instead of producing a wrong tree
- **Setup**: Create a legacy issue fixture with more than one local issue ref that could be interpreted as a parent.
- **Action**: Run the migration/import command.
- **Assert**: Migration fails with `ambiguous_legacy_parent` and no partial new tracker state is treated as a successful import.
- **Bug caught**: incorrect fallback parent selection or partially-applied migration state.

## Out of Scope

- changing the migrated data after import as part of the same task
- repo-specific live migration of this working tree outside repeatable automated tests
- new tracker features unrelated to import

## Done When

- [ ] A repeatable migration/import command exists and is documented
- [ ] Legacy fixtures import into canonical `.task` events that normal CLI reads understand
- [ ] Ambiguous parent inference aborts safely with `ambiguous_legacy_parent`
- [ ] Migration tests cover open/closed issues, hierarchy, stores, and refs
- [ ] Quality gates pass (`bun test`, `bun run typecheck`)
