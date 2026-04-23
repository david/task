# Refactor Plan: Root task CLI onto Esther `createApp`

## Goal

Refactor the root `task` CLI so command execution flows through Esther's app model instead of hand-wired event-store calls, custom folds, and bespoke projection rebuild code.

Target end state:
- a root `createApp(...)` wires the filesystem event store, projection adapters, processors if needed, and all CLI-facing slices
- CLI commands dispatch into `defineCommandSlice` / `defineQuerySlice` units
- projector/read-model updates persist current task state back to the filesystem as rebuildable projections and materialized views
- current CLI behavior, issue/document semantics, and on-disk tracker contracts remain stable unless an explicit migration task says otherwise

## Current Structure

Today the root CLI uses Esther only as low-level primitives:
- `src/tracker/root.ts` creates filesystem event/checkpoint stores directly
- `src/tracker/issue-create.ts` and `src/tracker/issues.ts` append `DomainEvent`s directly with `eventStore.append(...)`
- `src/tracker/event-core.ts` defines domain events/tags by hand
- `src/tracker/event-fold.ts` and `src/tracker/projections.ts` fold history and materialize issue/index state by hand
- `src/task.ts` parses argv and routes into imperative command functions in `src/commands.ts`

That means task is event-sourced, but not using Esther's main slice/app architecture.

## Esther Constraints From Docs

From `packages/esther/llms.txt` and source:
- `createApp(...)` is the intended composition root for event store, projection adapters, effect adapters, input adapter, and slices
- an input adapter only needs `start()`, `stop()`, and `bind(dispatch)`; current examples are in-memory and Fastify
- slices should own input parsing/validation, state resolution, event creation, and output shaping
- projectors and processors should stay pure; side effects belong in adapters
- read models should be declared with `defineReadModel(...)` and updated through projection adapters, not ad hoc file writes from domain modules
- query slices should resolve state through `tagQuery(...)`, `projection(...)`, or read-model queries rather than manual fold orchestration at command sites

## Target Structure

### 1. App bootstrap
Create a root app bootstrap that owns:
- Esther filesystem event store
- filesystem-backed projection adapters for task read models and materialized views
- optional projection query adapter when read-model queries become necessary
- a CLI input adapter or direct one-shot dispatch binding for command-line use
- registered command/query slices for the supported CLI surface

Likely home:
- `src/app/` or `src/tracker-app/` for slice/app wiring

### 2. CLI input adapter
Add a CLI-oriented Esther input adapter.

Required Esther contract is small:
- `start(): Promise<void>`
- `stop(): Promise<void>`
- `bind(dispatch)`

Desired task behavior:
- no long-running server
- accept normalized CLI dispatch from `src/task.ts`
- return raw Esther `Result` values so the existing JSON output layer can map them cleanly

This adapter may remain task-local first, then move into Esther later if it proves generic.

### 3. Slice-owned command semantics
Port CLI command execution into slices.

Write-heavy commands should become `defineCommandSlice(...)` slices, including at minimum:
- issue create
- close
- phase next/set where appropriate (`next` may be query if read-only)
- metadata updates
- label/ref updates
- document set/delete
- legacy import if retained in the same boundary

Read-heavy commands should become `defineQuerySlice(...)` slices where practical:
- show
- list
- search
- children
- parents
- related
- document get

The CLI parser should translate argv into stable input objects, then dispatch slice names instead of calling imperative tracker helpers directly.

### 4. Read models and filesystem projection adapters
Replace bespoke projection/materialization code with Esther read models plus projection adapters.

Needed projection surfaces likely include:
- current issue summary/state by id
- hierarchy indexes
- searchable issue listing/index rows
- visible document tree/materialized document content
- derived lookup/index data currently written under `.task/indexes/` and `.task/issues/`

The key Esther-aligned change:
- projectors should return projection results
- adapters should persist those results to filesystem-backed stores/materializations
- rebuildability should come from replaying canonical events through Esther wiring instead of hand-coded rebuild entrypoints scattered across tracker modules

### 5. Boundary cleanup
After parity exists, remove or collapse root-only custom Esther bypasses:
- direct `eventStore.append(...)` orchestration from command helpers
- ad hoc fold/materialize entrypoints whose only job is to stand in for slices/read models
- duplicated tag/build logic spread across command handlers and projector code

## Behavior Concentration Scan

| Behavior / Rule | Current locations | Likely canonical owner | Spread type | Risk | Refactor action |
|---|---|---|---|---|---|
| CLI command routing | `src/task.ts`, `src/commands.ts`, `src/commands-document.ts`, `src/commands-store.ts` | app bootstrap + slice registry | split orchestration | medium | consolidate |
| Domain event creation/tags | `src/tracker/event-core.ts`, `src/tracker/issue-create.ts`, `src/tracker/issues.ts`, `src/tracker/migrate.ts` | command slices + shared event module | duplicated orchestration | high | consolidate |
| Current-state folding | `src/tracker/event-fold.ts`, `src/tracker/projections.ts`, ad hoc callers | query slices + read models | split ownership | high | consolidate |
| Filesystem materialization | `src/tracker/projections.ts`, `src/tracker/stores.ts`, hierarchy helpers | filesystem projection adapters | bespoke persistence path | high | consolidate |
| Optimistic concurrency on writes | `src/tracker/issues.ts`, `src/tracker/issue-create.ts` | command slices calling Esther pipeline | concentrated but bypassing app | medium | delegate |
| Output shaping for CLI JSON | command handlers + parser/output layer | CLI boundary over slice results | split formatting | medium | preserve |

## Behavioral Invariants

This refactor must preserve:
- current CLI grammar and flag behavior
- current JSON output contracts unless a separate behavior-change issue approves changes
- current canonical event semantics and issue/document behavior
- current hierarchy semantics based on parent/child issue relationships
- current document visibility and phase-finalization rules
- optimistic concurrency guarantees on issue-boundary writes
- rebuildability from canonical `.task/events/`

If any of these must change, split that into a separate feature/debug issue instead of hiding it inside this refactor.

## Protected Contracts

### CLI contracts
- existing command names and argument forms continue to work
- positional vs switch behavior stays identical
- normal output stays compact JSON without added prose

### Storage contracts
- `.task/events/` remains canonical
- `.task/issues/`, `.task/indexes/`, and `.task/checkpoints/` remain rebuildable derived state
- issue/document/history semantics remain append-only

### Domain contracts
- issue ids, phases, labels, refs, and document selectors keep their current meaning
- relationship commands continue reading hierarchy state, not `refs`
- closed issues remain queryable

## Proposed Sequencing

1. **Characterize current contracts**
   - inventory imperative command entrypoints and tracker helpers
   - identify current event shapes, tags, projection files, and read paths that must remain stable
   - add characterization tests where behavior is currently protected only indirectly

2. **Introduce app bootstrap without behavior change**
   - create a root `createApp(...)` bootstrap using the existing filesystem event store
   - add a task-local CLI input adapter or dispatch binding
   - register a minimal first slice behind one command path to prove the wiring

3. **Define read models and filesystem projection adapters**
   - model current issue state and hierarchy/index rows as Esther read models
   - implement filesystem projection adapters that persist read-model results to repo-local task files
   - ensure projector replay can rebuild current views from canonical history

4. **Port commands slice by slice**
   - migrate mutating commands first so event creation and validation live in slices
   - migrate read commands onto query slices/read-model lookups
   - keep CLI output shaping at the outer boundary

5. **Remove redundant manual projection code**
   - collapse custom fold/rebuild helpers that are superseded by slices/read models/adapters
   - keep only compatibility helpers still justified at the filesystem boundary

6. **Full verification and cleanup**
   - rerun full tests/lint/typecheck
   - confirm projection rebuild, closed-issue reads, hierarchy queries, and document lifecycle parity

## Characterization-Test Needs

Before and during the refactor, keep or add explicit protection for:
- create/show/list/search parity
- document set/get/delete and phase-finalization behavior
- hierarchy parent/child queries
- closed-issue queryability
- projection rebuild from canonical events
- optimistic concurrency failures on stale writes
- parser-level CLI routing for positional + switch combinations

## Verification Contract

### Automated proof
- `bun test`
- `bun run lint`
- `bun run typecheck`
- `bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff`

### Focused regression proof
- command tests covering create/show/list/search
- lifecycle tests covering close, rebuild, and array updates
- document tests covering set/get/delete and legacy-history projections
- parser tests in `src/task.test.ts`

### Manual spot checks
- create issue, then show/list/search it
- create parent/child issues and verify `children` / `parents` / `related`
- write document content, change phase, then rewrite in later phase and inspect visible state
- delete a derived index/projection file and confirm reads rebuild from canonical events

## Open Design Questions

1. Should the CLI input adapter live in `task` first or in `packages/esther/` as a generic adapter?
2. Should filesystem projection persistence be task-local first, or should Esther grow a reusable filesystem read-model adapter?
3. Which current materialized files are true read models versus convenience views that should be emitted from a second-stage adapter?
4. Should all current read commands become query slices immediately, or should some thin compatibility layer remain during migration?

## Exit Criteria

This epic is done when:
- root CLI command execution goes through Esther `createApp(...)`
- CLI command handlers dispatch slices instead of calling direct tracker append/fold helpers
- current filesystem projections/materializations are produced via Esther read models/projection adapters
- the old bespoke orchestration paths are removed or reduced to thin boundary adapters
- full repo verification passes with no behavior regressions
