# In-Repo Event-Sourced Task Storage

## Problem

The current tracker stores mutable issue state outside the project, which makes task history hard to version with the code it belongs to, increases commit churn, and creates avoidable merge conflicts when multiple agents or workflows touch nearby files. The next version should make the tracker repo-local, append-only, and event-sourced, while preserving the current CLI experience where it still makes sense and making this project itself a consumer of the new system.

## Solution Overview

Replace the current mutable filesystem-backed tracker with an in-repo task system under `.task/` whose source of truth is Esther’s filesystem-backed `EventStore`.

Task adopts Esther’s existing tag-based model:
- issue history is defined by tags, not by a task-specific stream abstraction
- each issue event carries a stable issue tag such as `issue:<id>`
- hierarchy is modeled in events and tags, then materialized into directory/tree projections
- current state, indexes, and tree views are rebuildable projections over canonical event files

The CLI remains structurally familiar for issue creation, listing, reading, relationship queries, store operations, and closing. The intentional workflow changes are:
- phase transitions become a first-class command instead of generic metadata updates
- task owns workflow progression knowledge, including what the next phase should be
- phase transitions implicitly finalize draft store revisions for the issue

Key behaviors:
- `task create` supports explicit `--parent <id>`
- `children` / `parents` derive from hierarchy projections, not refs
- `refs` remain for cross-tree and external relationships
- all skill-managed artifacts continue to go through `task`
- store artifacts are editable while the issue is in its current phase
- changing phase automatically finalizes all draft store revisions for that issue
- later edits in a new phase create new draft revisions instead of mutating finalized artifacts
- `.task/settings.json` defines the allowed phases, default phase, and transition graph
- `task phase next <id>` returns the next configured phase for the issue

Dogfooding happens only after:
1. the new tracker is implemented,
2. migration support exists,
3. this repo’s old data is migrated into the new format.

Implementation constraint for this repo:
- make active tracker changes under `src/`
- leave legacy top-level files and compatibility shims alone unless a later task explicitly calls for changing them

## Esther Alignment

Task targets Esther as implemented on `main` after the filesystem adapter landed.

### Canonical storage
- Canonical history is Esther event data stored as one immutable JSON file per event.
- Task does not define its own stream store.
- Physical event placement is an Esther filesystem-adapter detail and may shard by stable tags such as `issue:<id>`.
- Canonical event files win over indexes, trees, and other materialized views if they disagree.

### Query and concurrency model
- Reads reconstruct issue history through `queryByTags(...)`.
- For issue-local reads, task uses the issue boundary tag: `issue:<id>`.
- `queryByTags(...)` returns both folded state and `maxPosition`.
- Writes use Esther append preconditions via:
  - `expectedPosition`
  - `boundaryTags`
- For issue-local writes, task uses `boundaryTags: ["issue:<id>"]`.
- This is the optimistic concurrency mechanism for preventing lost updates within an issue boundary.

### Hierarchy model
- Parent/child remains a first-class task concept.
- `IssueCreated` carries `parentId` in payload and child issue events also carry `parent:<parentId>` when applicable.
- Directory nesting is a projection/materialization of that hierarchy, not the source of truth.
- `children` / `parents` operate on the hierarchy projection built from events.

### Projections and checkpoints
- Task may maintain rebuildable JSON projections such as:
  - current issue state
  - hierarchy/tree indexes
  - search and short-id indexes
  - materialized store content
- Task uses Esther’s filesystem checkpoint store for rebuildable projectors/materializers.
- SQLite is out of scope for v1.

## Event Model

### Commands

#### CreateIssue
- **Trigger**: `task create --title ... [--parent <id>] ...`
- **Aggregate / boundary**: issue boundary, with parent validation when `--parent` is provided
- **Input**:
  - `title: string`
  - `description: string`
  - `priority: number`
  - `labels: string[]`
  - `githubIssue?: number`
  - `parentId?: string`
- **Events produced**:
  - `IssueCreated`
- **Exceptions**:
  - `parent_not_found`
  - `parent_closed`
  - `invalid_parent_reference`

Tags on `IssueCreated`:
- always: `issue:<issueId>`, `kind:issue`
- when child issue: `parent:<parentId>`

#### CloseIssue
- **Trigger**: `task close <id>`
- **Aggregate / boundary**: issue boundary
- **Input**:
  - `issueId: string`
- **Events produced**:
  - `IssueClosed`
- **Exceptions**:
  - none; closing an already closed issue is an idempotent no-op

#### SetIssuePhase
- **Trigger**: `task phase set <id> --value <phase>`
- **Aggregate / boundary**: issue boundary
- **Input**:
  - `issueId: string`
  - `phase: string`
- **Events produced**:
  - `IssuePhaseChanged`
  - zero or more `StoreRevisionFinalized`
- **Exceptions**:
  - `issue_not_found`
  - `invalid_phase`
  - `phase_unchanged`
  - `invalid_phase_transition`

Behavior:
- changing phase is the implicit commit boundary for skill-managed artifacts
- all draft store revisions for the issue are finalized as part of the transition
- the allowed phases and transitions come from `.task/settings.json`
- append uses Esther boundary preconditions for `issue:<id>`

#### GetNextPhase
- **Trigger**: `task phase next <id>`
- **Aggregate / boundary**: read-only issue query
- **Input**:
  - `issueId: string`
- **Events produced**:
  - none
- **Exceptions**:
  - `issue_not_found`
  - `no_next_phase`
  - `invalid_phase_config`

Behavior:
- resolves current issue phase from projections or folded issue history
- reads `.task/settings.json`
- returns the configured next phase for the current phase

#### SetIssueMetadata
- **Trigger**: `task meta set <id> --key <key> --value <value>`
- **Aggregate / boundary**: issue boundary
- **Input**:
  - `issueId: string`
  - `key: string`
  - `value: string | number | boolean | null`
- **Events produced**:
  - `IssueMetadataSet`
- **Exceptions**:
  - `issue_not_found`
  - `reserved_metadata_key`

Reserved keys include:
- `status`
- `phase`
- `parentId`

#### UpdateIssueLabels
- **Trigger**: `task update label <id> --add ... --remove ...`
- **Aggregate / boundary**: issue boundary
- **Input**:
  - `issueId: string`
  - `add: string[]`
  - `remove: string[]`
- **Events produced**:
  - `IssueLabelsChanged`
- **Exceptions**:
  - `issue_not_found`

#### UpdateIssueRefs
- **Trigger**: `task update refs <id> --add ... --remove ...`
- **Aggregate / boundary**: issue boundary
- **Input**:
  - `issueId: string`
  - `add: string[]`
  - `remove: string[]`
- **Events produced**:
  - `IssueRefsChanged`
- **Exceptions**:
  - `issue_not_found`

#### SaveStoreRevision
- **Trigger**: `task store set <id> --store <store> --key <key> ...`
- **Aggregate / boundary**: issue boundary
- **Input**:
  - `issueId: string`
  - `store: string`
  - `key: string`
  - `content: string`
- **Events produced**:
  - `StoreRevisionSaved`
- **Exceptions**:
  - `issue_not_found`
  - `invalid_store_name`
  - `invalid_store_key`

Behavior:
- if the key has an active draft revision in the current phase, this updates that draft revision
- if the latest revision for the key is already finalized, this creates a new draft revision in the current phase
- users and skills do not finalize explicitly; phase change does that implicitly
- append uses Esther boundary preconditions for `issue:<id>`

#### DeleteStoreEntry
- **Trigger**:
  - `task store delete <id> --store <store> --key <key>`
  - `task store delete <id> --store <store>`
- **Aggregate / boundary**: issue boundary
- **Input**:
  - `issueId: string`
  - `store: string`
  - `key?: string`
- **Events produced**:
  - `StoreEntryDeleted`
  - `StoreDeleted`
- **Exceptions**:
  - none; deleting a missing key or store is an idempotent no-op

Behavior:
- deletion is logical, not physical
- historical revisions remain in the event log and history
- current projections stop surfacing the deleted key or store

#### ImportLegacyTracker
- **Trigger**: one-time migration script
- **Aggregate / boundary**: project-level import process
- **Input**:
  - `legacyRoot: string`
  - `targetProject: string`
- **Events produced**:
  - normal domain events (`IssueCreated`, `IssuePhaseChanged`, `IssueMetadataSet`, `IssueLabelsChanged`, `IssueRefsChanged`, `StoreRevisionSaved`, `StoreRevisionFinalized`, `IssueClosed`)
  - `LegacyImportCompleted`
- **Exceptions**:
  - `legacy_tracker_not_found`
  - `target_already_initialized`
  - `ambiguous_legacy_parent`

Behavior:
- the script imports current legacy state as initial history in the new tracker
- legacy local refs are interpreted as parent candidates only during migration
- external refs remain refs
- a migrated store entry becomes finalized revision 1 in the issue’s current phase unless explicitly imported as a draft

### Events

#### IssueCreated
- **Payload**:
  - `issueId: string`
  - `parentId?: string`
  - `title: string`
  - `description: string`
  - `status: "open"`
  - `phase: string`
  - `priority: number`
  - `labels: string[]`
  - `refs: string[]`
  - `githubIssue?: number`
  - `createdAt: string`
- **Tags**:
  - `issue:<issueId>`
  - `kind:issue`
  - optionally `parent:<parentId>`
- **Meaning**: A new issue now exists in the project hierarchy.

#### IssueClosed
- **Payload**:
  - `issueId: string`
  - `closedAt: string`
- **Tags**:
  - `issue:<issueId>`
- **Meaning**: The issue is closed but remains in place in the hierarchy.

#### IssuePhaseChanged
- **Payload**:
  - `issueId: string`
  - `from: string`
  - `to: string`
  - `changedAt: string`
- **Tags**:
  - `issue:<issueId>`
  - `phase:<to>`
- **Meaning**: The issue advanced to a new workflow phase.

#### IssueMetadataSet
- **Payload**:
  - `issueId: string`
  - `key: string`
  - `value: unknown`
  - `updatedAt: string`
- **Tags**:
  - `issue:<issueId>`
- **Meaning**: A non-reserved metadata field changed.

#### IssueLabelsChanged
- **Payload**:
  - `issueId: string`
  - `added: string[]`
  - `removed: string[]`
  - `updatedAt: string`
- **Tags**:
  - `issue:<issueId>`
- **Meaning**: Labels were updated.

#### IssueRefsChanged
- **Payload**:
  - `issueId: string`
  - `added: string[]`
  - `removed: string[]`
  - `updatedAt: string`
- **Tags**:
  - `issue:<issueId>`
- **Meaning**: Non-tree references were updated.

#### StoreRevisionSaved
- **Payload**:
  - `issueId: string`
  - `store: string`
  - `key: string`
  - `revision: number`
  - `phase: string`
  - `draft: boolean`
  - `content: string`
  - `supersedesRevision?: number`
  - `savedAt: string`
- **Tags**:
  - `issue:<issueId>`
  - `store:<store>`
- **Meaning**: A store entry’s draft content was created or updated in a phase.

#### StoreRevisionFinalized
- **Payload**:
  - `issueId: string`
  - `store: string`
  - `key: string`
  - `revision: number`
  - `phase: string`
  - `finalizedAt: string`
- **Tags**:
  - `issue:<issueId>`
  - `store:<store>`
- **Meaning**: A draft revision became immutable because its phase was completed.

#### StoreEntryDeleted
- **Payload**:
  - `issueId: string`
  - `store: string`
  - `key: string`
  - `deletedAt: string`
- **Tags**:
  - `issue:<issueId>`
  - `store:<store>`
- **Meaning**: A single key was removed from the current projection.

#### StoreDeleted
- **Payload**:
  - `issueId: string`
  - `store: string`
  - `deletedAt: string`
- **Tags**:
  - `issue:<issueId>`
  - `store:<store>`
- **Meaning**: An entire store was removed from the current projection.

#### LegacyImportCompleted
- **Payload**:
  - `importedIssues: number`
  - `importedStores: number`
  - `completedAt: string`
- **Meaning**: One-time import completed successfully.

## Views and Materializations

### TaskSettingsView
- **Purpose**: Expose workflow configuration from `.task/settings.json`.
- **Source**: configuration file, not domain events.

### IssueStateView
- **Purpose**: Return current issue state for `show`, `list`, `search`, and `meta get`.
- **Source events**:
  - all issue lifecycle and store events tagged with `issue:<id>` as needed
- **Query pattern**:
  - fold issue-local history from Esther tag queries and/or consume rebuildable projections

### IssueHierarchyView
- **Purpose**: Support `children`, `parents`, and tree navigation.
- **Source events**:
  - `IssueCreated`
  - `IssueClosed`
- **Model**:
  - derives hierarchy from `parentId` payloads and `parent:<id>` tags
- **Materialization**:
  - may write a browsable `.task` tree
  - directory hierarchy is derived, not authoritative

### StoreEntryView
- **Purpose**: Return current visible store keys and content for `store get`, `store keys`, and `show --include-stores`.
- **Source events**:
  - `StoreRevisionSaved`
  - `StoreRevisionFinalized`
  - `StoreEntryDeleted`
  - `StoreDeleted`
  - `IssuePhaseChanged`

### TaskIndex
- **Purpose**: Fast global lookup and search across the repo-local tracker.
- **Backed by**: rebuildable JSON projections over Esther event files.
- **May include**:
  - short-id resolution
  - search text indexes
  - hierarchy indexes
  - store key indexes

## Automations

### ProjectionUpdater
- **Trigger**: all domain events
- **Action**: update rebuildable current-state projections and indexes
- **Checkpointing**: use Esther filesystem checkpoints

### StoreMaterializer
- **Trigger**:
  - `StoreRevisionSaved`
  - `StoreRevisionFinalized`
  - `StoreEntryDeleted`
  - `StoreDeleted`
- **Action**: materialize current store content and human-browsable files under `.task`
- **Checkpointing**: use Esther filesystem checkpoints

### LegacyImportProcessor
- **Trigger**: migration script execution
- **Action**: validate import preconditions, emit import events, write an import report

## Non-Goals

- Preserving the legacy global storage layout
- Allowing direct manual edits to tracker storage outside `task`
- Introducing a task-specific stream abstraction on top of Esther
- Making directory layout or tree materializations authoritative
- Enforcing per-skill store ownership in v1
- Introducing move or reparent commands in v1
- Adding SQLite in v1

## Migration

A separate one-time migration script converts legacy tracker data into the new repo-local format.

Migration rules:
- target must not already contain an initialized new tracker
- legacy issue metadata is imported as initial issue state
- legacy phase is imported as the issue’s current phase
- legacy store files are imported as finalized revision 1 in that phase
- legacy closed issues stay in place after import; they are represented by `IssueClosed`
- external refs remain refs
- parent/child inference uses legacy local refs:
  - `0` local issue refs → imported as root issue
  - `1` local issue ref → imported as child of that parent; that specific ref becomes structure, not a ref
  - `>1` local issue refs → import aborts with `ambiguous_legacy_parent`
- original created and updated timestamps are preserved where possible
- after migration, this repo can switch to dogfooding the new tracker

Rollout order:
1. implement task on top of Esther’s filesystem event store
2. implement task projections/materializers/checkpoint usage
3. implement migration script
4. migrate this repo
5. switch daily usage to the new tracker

## Open Questions

1. What exact shape should `.task/settings.json` use for transitions and default-next-phase lookup?
2. Should `task phase next <id>` return a single default next phase or all allowed next phases?
3. Should task materialize a browsable hierarchy tree by default, or only when explicitly requested/rebuilt?
