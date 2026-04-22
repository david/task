# Test Plan: In-repo append-only event-sourced task storage

## Data flow

### Core command flow
`task <command>`
→ repo-local tracker resolution under `.task/`
→ task command handler reads config / current issue state
→ Esther `queryByTags(...)` reconstructs the relevant issue or project state
→ task appends domain events with `append(..., { expectedPosition, boundaryTags })`
→ task projectors/materializers update current issue state, hierarchy indexes, search indexes, and visible store content
→ later CLI reads (`show`, `list`, `children`, `parents`, `related`, `store get`, `phase next`) read those projections or rebuild from canonical event files
→ observable output: CLI JSON plus canonical `.task` event files and rebuildable projection/checkpoint files

### Hierarchy flow
`task create --parent <id>`
→ `IssueCreated` carries `parentId` payload and `parent:<id>` tag
→ hierarchy projection/materialization updates parent/child indexes
→ `task children`, `task parents`, and `task related` surface the relationship

### Store lifecycle flow
`task store set <id> --store <store> --key <key>`
→ `StoreRevisionSaved` for the issue’s current phase
→ `task phase set <id> --value <next>`
→ `IssuePhaseChanged` + `StoreRevisionFinalized` for all open drafts on that issue
→ later `task store set` in the new phase creates a new draft revision instead of mutating the finalized one
→ `task store get` and current store materialization show the latest visible content while canonical event files preserve revision history

### Migration flow
legacy tracker data
→ migration/import command emits normal task domain events into `.task`
→ projectors rebuild issue state, store state, and hierarchy from imported events
→ normal CLI commands return the migrated state without consulting the old storage

## Wiring points identified
1. **Repo-local storage resolution** — commands could accidentally keep using `~/.local/share/issues` or share state across repos instead of using `.task/`.
2. **Issue-boundary append/query tagging** — writes could succeed without the right `issue:<id>` / `parent:<id>` / `store:<store>` tags, causing later reads and projections to miss them.
3. **Hierarchy projection** — `create --parent` could record parentage in the event payload but fail to surface in `children` / `parents` / `related`, especially if legacy `refs` logic still drives those commands.
4. **Phase configuration wiring** — `task phase next` and `task phase set` could read `.task/settings.json` inconsistently, allowing invalid transitions or returning the wrong next phase.
5. **Implicit store finalization on phase change** — phase changes could update the issue phase but forget to finalize draft store revisions.
6. **Post-finalization store editing** — later `store set` calls could overwrite finalized content instead of creating a new phase-scoped draft revision.
7. **Closed-issue visibility** — `IssueClosed` could be appended correctly but fail to show up in `show`, `list --all`, search, or hierarchy queries.
8. **Projection rebuild from canonical history** — stale or deleted indexes/materializations could make the CLI look empty or wrong even though the event log is correct.
9. **Migration wiring** — imported metadata, stores, hierarchy, or closed state could land in the event log but fail to appear in normal CLI output.
10. **Optimistic concurrency** — stale writers could append anyway if `expectedPosition` / `boundaryTags` are not wired through command handlers.

## Required tests

### Repo-local tracker isolation
- **Level**: scenario
- **Setup**: Create two temporary repos and seed a legacy global issue outside them.
- **Action**: Run `task create` and `task list` inside repo A, then run `task list` inside repo B.
- **Assert**: Repo A sees only its own `.task` data; repo B does not see repo A’s issue; the old global issue is ignored; canonical event files are created under repo A’s `.task`.
- **Catches**: Commands still wired to the legacy global storage path or leaking state across repos.

### Create issue is visible through normal reads
- **Level**: scenario
- **Setup**: In a clean repo, create an issue with title, description, labels, priority, and optional GitHub issue metadata.
- **Action**: Run `task show`, `task list`, and `task search` for the new issue.
- **Assert**: All returned fields match the created issue; the issue is discoverable through normal command output; canonical event files exist for the new issue.
- **Catches**: Append succeeds but current-state projection or CLI read path is not wired to the event-backed source of truth.

### Parent-child hierarchy flows from `create --parent` to relationship commands
- **Level**: scenario
- **Setup**: Create a parent issue, then create a child issue with `--parent <parent-id>` and no manual refs.
- **Action**: Run `task children <parent>`, `task parents <child>`, and `task related <parent>`.
- **Assert**: The child appears under the parent, the parent appears for the child, and the relationship is visible without relying on `refs` mutation.
- **Catches**: Parentage captured in events but not in hierarchy projection, or relationship commands still reading legacy refs-based logic.

### Phase commands honor `.task/settings.json`
- **Level**: integration
- **Setup**: Configure `.task/settings.json` with a non-trivial phase graph and create an issue in the default phase.
- **Action**: Run `task phase next <id>`, then `task phase set <id> --value <allowed-next>`, then attempt an invalid transition.
- **Assert**: `phase next` returns the configured next phase, `show` reports the new phase after the valid transition, and the invalid transition fails with a clear error.
- **Catches**: One code path reading config while another hardcodes workflow rules, or phase commands bypassing transition validation.

### Phase change finalizes all open store drafts for that issue
- **Level**: integration
- **Setup**: Create an issue, save one or more store entries in its current phase, and leave them as drafts.
- **Action**: Advance the issue with `task phase set`.
- **Assert**: The phase changes successfully, the latest current store content remains visible, and the canonical event history includes `StoreRevisionFinalized` entries for every draft store key on that issue.
- **Catches**: Phase transitions that move the issue forward but forget the implicit store-finalization step.

### Editing the same store key in a later phase creates a new revision instead of mutating finalized content
- **Level**: integration
- **Setup**: Start from an issue with a finalized store entry from an earlier phase.
- **Action**: Run `task store set` for the same store/key in the new phase, then inspect current store output and canonical event history.
- **Assert**: `task store get` returns the new content, while the event log still contains the earlier finalized revision and a new later-phase draft revision with a higher revision number.
- **Catches**: Silent mutation of finalized artifacts or loss of phase-scoped revision history.

### Closing an issue updates visible state without depending on archive moves
- **Level**: scenario
- **Setup**: Create an issue that participates in hierarchy or search results.
- **Action**: Run `task close <id>`, then run `task show`, `task list --all`, and a relationship query involving that issue.
- **Assert**: The issue remains addressable, reports `status: closed`, and still participates correctly in relationship lookups; the close is represented by event history rather than a legacy archive move.
- **Catches**: Close command appends `IssueClosed` but read models or relationship queries stop surfacing the issue correctly.

### CLI reads rebuild correctly when projections or indexes are stale
- **Level**: integration
- **Setup**: Create issues and store content, then delete or corrupt rebuildable `.task` indexes/materializations while leaving canonical event files intact.
- **Action**: Run normal read commands such as `task show`, `task list`, `task children`, or `task store get`.
- **Assert**: Commands still return correct current state and recreate the missing/corrupt derived files from canonical event history.
- **Catches**: Reads that trust stale projections over the event log, or rebuild logic that is not wired into user-facing commands.

### Legacy migration produces equivalent CLI-visible state in the new tracker
- **Level**: scenario
- **Setup**: Create a representative legacy tracker fixture with open and closed issues, store files, labels, refs, and at least one unambiguous parent inferred from a local ref.
- **Action**: Run the migration/import command, then query the migrated issues with `show`, `list`, `children`, `parents`, `store get`, and search commands.
- **Assert**: The migrated repo exposes the same current issue metadata and store contents through the new CLI, parent inference is preserved, closed issues remain closed, and canonical `.task` events exist for the imported state.
- **Catches**: Import code that writes events but fails to wire projections, hierarchy, or store materialization to those events.

### Ambiguous legacy parents abort migration instead of producing a wrong tree
- **Level**: integration
- **Setup**: Create a legacy issue fixture with more than one local issue ref that could be interpreted as a parent.
- **Action**: Run the migration/import command.
- **Assert**: Migration fails with `ambiguous_legacy_parent` and no partial new tracker state is treated as successfully imported.
- **Catches**: Incorrect fallback parent selection or partially-applied migration results.

### Stale issue writes fail with optimistic-concurrency errors
- **Level**: integration
- **Setup**: Read an issue’s current state/position, then perform one successful write to that same issue boundary.
- **Action**: Attempt a second write using the stale read as its basis (for example, another phase change or store save against the old position).
- **Assert**: The second write fails with a concurrency error and the issue’s visible current state remains the first successful write.
- **Catches**: Command handlers that forget to pass `expectedPosition` or `boundaryTags`, allowing lost updates.

## Regression test
- Not applicable; this is a feature/design change rather than a single reproduced bug.
