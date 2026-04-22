# Hierarchical Issue Document Keys

## Problem
The current issue-attached content model exposes two user-facing concepts, `store` and `key`, even though users primarily think in terms of named documents attached to an issue. That leaks the current two-level filesystem shape into the CLI, prevents arbitrary-depth hierarchies, and makes commands like `task store set --store research --key summary` feel like implementation details rather than product behavior. We need a cleaner issue-scoped document model that preserves issue metadata and phase-aware revision history while replacing the two-level `store/key` abstraction with a single hierarchical key path.

## Solution Overview
Keep attached content scoped to an issue, but replace `store + key` with one canonical hierarchical `key` path. The user-facing command family becomes `task set`, `task get`, and `task delete`, all operating on an issue ID plus `--key <path>`. Paths support arbitrary depth with `/` as the only separator. A trailing `/` selects a subtree, and `--key /` selects the full attached-document tree for an issue.

The write model stays append-only and phase-aware: saving content creates or updates the current draft revision for that issue/path in the current phase; changing phase finalizes open draft revisions; saving the same path in a later phase creates a new revision that supersedes the prior finalized revision. The read model exposes a recursive `value`/`entries` tree and materializes visible documents onto disk as markdown files and directories, allowing a path to be both a document and a subtree root.

## Event Model

### Commands

#### SaveIssueDocument
- **Trigger**: `task set <issue-id> --key <path> [--value <value> | --file <path> | stdin]`
- **Aggregate**: Issue
- **Input**:
  - `issueId: string`
  - `path: string` — canonical logical path, no trailing `/`
  - `content: string`
- **Events produced**:
  - `IssueDocumentRevisionSaved`
- **Exceptions**:
  - `issue_not_found`
  - `invalid_key_path`
  - `subtree_selector_not_allowed` when `--key` ends with `/`
  - `root_selector_not_allowed` when `--key /` is used with `set`

##### Scenarios
```text
Given IssueCreated(issueId="hz11", phase="research")
When SaveIssueDocument(issueId="hz11", path="research/notes/today", content="hello")
Then IssueDocumentRevisionSaved(
  issueId="hz11",
  path="research/notes/today",
  revision=1,
  phase="research",
  draft=true,
  content="hello"
)
```

```text
Given IssueCreated(issueId="hz11", phase="research")
When SaveIssueDocument(issueId="hz11", path="research//today", content="hello")
Then exception "invalid_key_path"
```

```text
Given IssueCreated(issueId="hz11", phase="research")
And IssueDocumentRevisionSaved(issueId="hz11", path="research/plan", revision=1, phase="research", draft=false, content="phase one")
And IssuePhaseChanged(issueId="hz11", from="research", to="ready-to-code")
When SaveIssueDocument(issueId="hz11", path="research/plan", content="phase two")
Then IssueDocumentRevisionSaved(
  issueId="hz11",
  path="research/plan",
  revision=2,
  phase="ready-to-code",
  draft=true,
  supersedesRevision=1,
  content="phase two"
)
```

#### DeleteIssueDocument
- **Trigger**: `task delete <issue-id> --key <path>`
- **Aggregate**: Issue
- **Input**:
  - `issueId: string`
  - `path: string` — canonical logical path, no trailing `/`
- **Events produced**:
  - `IssueDocumentDeleted` when the exact path currently has a visible value
  - no events for a missing exact path
- **Exceptions**:
  - `issue_not_found`
  - `invalid_key_path`

##### Scenarios
```text
Given IssueCreated(issueId="hz11", phase="research")
And IssueDocumentRevisionSaved(issueId="hz11", path="research", revision=1, phase="research", draft=true, content="overview")
When DeleteIssueDocument(issueId="hz11", path="research")
Then IssueDocumentDeleted(issueId="hz11", path="research")
```

```text
Given IssueCreated(issueId="hz11", phase="research")
When DeleteIssueDocument(issueId="hz11", path="research")
Then no events
```

#### DeleteIssueDocumentSubtree
- **Trigger**: `task delete <issue-id> --key <path>/`
- **Aggregate**: Issue
- **Input**:
  - `issueId: string`
  - `pathPrefix: string` — canonical path prefix without trailing `/`
- **Events produced**:
  - `IssueDocumentSubtreeDeleted` when any visible documents exist at or below that prefix
  - no events when the subtree is empty
- **Exceptions**:
  - `issue_not_found`
  - `invalid_key_path`

##### Scenarios
```text
Given IssueCreated(issueId="hz11", phase="research")
And IssueDocumentRevisionSaved(issueId="hz11", path="research", revision=1, phase="research", draft=true, content="overview")
And IssueDocumentRevisionSaved(issueId="hz11", path="research/notes/today", revision=1, phase="research", draft=true, content="today")
And IssueDocumentRevisionSaved(issueId="hz11", path="research/notes/tomorrow", revision=1, phase="research", draft=true, content="tomorrow")
When DeleteIssueDocumentSubtree(issueId="hz11", pathPrefix="research")
Then IssueDocumentSubtreeDeleted(issueId="hz11", pathPrefix="research")
```

```text
Given IssueCreated(issueId="hz11", phase="research")
When DeleteIssueDocumentSubtree(issueId="hz11", pathPrefix="research")
Then no events
```

#### ClearIssueDocuments
- **Trigger**: `task delete <issue-id> --key /`
- **Aggregate**: Issue
- **Input**:
  - `issueId: string`
- **Events produced**:
  - `IssueDocumentsCleared` when any visible issue documents exist
  - no events when the issue has no attached documents
- **Exceptions**:
  - `issue_not_found`

##### Scenarios
```text
Given IssueCreated(issueId="hz11", phase="research")
And IssueDocumentRevisionSaved(issueId="hz11", path="research/plan", revision=1, phase="research", draft=true, content="plan")
And IssueDocumentRevisionSaved(issueId="hz11", path="qa/checklist", revision=1, phase="research", draft=true, content="checklist")
When ClearIssueDocuments(issueId="hz11")
Then IssueDocumentsCleared(issueId="hz11")
```

#### AdvanceIssuePhase
- **Trigger**: existing phase-advance command
- **Aggregate**: Issue
- **Input**:
  - existing issue phase transition inputs
- **Events produced**:
  - existing `IssuePhaseChanged`
  - `IssueDocumentRevisionFinalized` for every open visible draft revision on the issue
- **Exceptions**:
  - existing phase transition exceptions
- **Notes**:
  - This feature changes draft finalization from `(store, key)` identity to full-path identity.

##### Scenarios
```text
Given IssueCreated(issueId="hz11", phase="research")
And IssueDocumentRevisionSaved(issueId="hz11", path="research/plan", revision=1, phase="research", draft=true, content="draft plan")
And IssueDocumentRevisionSaved(issueId="hz11", path="research/notes/today", revision=1, phase="research", draft=true, content="notes")
When AdvanceIssuePhase(issueId="hz11", to="ready-to-code")
Then IssuePhaseChanged(issueId="hz11", from="research", to="ready-to-code")
And IssueDocumentRevisionFinalized(issueId="hz11", path="research/plan", revision=1, phase="research")
And IssueDocumentRevisionFinalized(issueId="hz11", path="research/notes/today", revision=1, phase="research")
```

### Events

#### IssueDocumentRevisionSaved
- **Aggregate**: Issue
- **Payload**:
  - `issueId: string`
  - `path: string`
  - `revision: number`
  - `phase: string`
  - `draft: boolean`
  - `content: string`
  - `savedAt: string`
  - `supersedesRevision?: number`
- **Meaning**: The issue’s current visible document content at `path` was saved as a draft revision for the current phase.

#### IssueDocumentRevisionFinalized
- **Aggregate**: Issue
- **Payload**:
  - `issueId: string`
  - `path: string`
  - `revision: number`
  - `phase: string`
  - `finalizedAt: string`
- **Meaning**: A previously open document draft revision became finalized for its phase.

#### IssueDocumentDeleted
- **Aggregate**: Issue
- **Payload**:
  - `issueId: string`
  - `path: string`
  - `deletedAt: string`
- **Meaning**: The exact visible document at `path` was removed from the current issue document view.

#### IssueDocumentSubtreeDeleted
- **Aggregate**: Issue
- **Payload**:
  - `issueId: string`
  - `pathPrefix: string`
  - `deletedAt: string`
- **Meaning**: All visible documents at or below `pathPrefix` were removed from the current issue document view.

#### IssueDocumentsCleared
- **Aggregate**: Issue
- **Payload**:
  - `issueId: string`
  - `deletedAt: string`
- **Meaning**: All visible attached documents for the issue were removed from the current issue document view.

### Views (Read Models)

#### IssueDocumentTree
- **Purpose**: Return exact-document, subtree, or full-tree content for `task get`.
- **Source events**:
  - `IssueDocumentRevisionSaved`
  - `IssueDocumentRevisionFinalized`
  - `IssueDocumentDeleted`
  - `IssueDocumentSubtreeDeleted`
  - `IssueDocumentsCleared`
- **Schema**:
  - command result root:
    - `entries: Record<string, IssueDocumentNode>`
  - node:
    - `value?: string`
    - `entries?: Record<string, IssueDocumentNode>`
  - invariant:
    - a node must have at least one of `value` or `entries`
    - no node may exist with neither
- **Query patterns**:
  - `task get <id> --key research/notes/today`
  - `task get <id> --key research/`
  - `task get <id> --key /`
  - exact-path reads return a tree containing the selected path as the top-level returned entry
  - subtree reads return a tree containing the selected subtree root as the top-level returned entry
  - root reads (`/`) return all top-level issue document nodes
  - missing reads return `{ "entries": {} }`

#### IssueDocumentKeyIndex
- **Purpose**: Expose which logical document paths currently exist on an issue without returning their content.
- **Source events**:
  - same as `IssueDocumentTree`
- **Schema**:
  - `keys: string[]` — sorted logical paths with visible values
- **Query patterns**:
  - included in issue inspection output where the old store index would otherwise have been shown
  - suppressible by the same compact/summary field narrowing rules that suppress other derived extras

#### IssueDocumentMaterialization
- **Purpose**: Materialize the current visible issue document view onto disk in a structure that supports both leaf values and subtree roots.
- **Source events**:
  - same as `IssueDocumentTree`
- **Schema**:
  - logical path `research` materializes as `research.md`
  - logical path `research/notes/today` materializes as `research/notes/today.md`
  - a path may have both:
    - `<path>.md`
    - `<path>/...`
- **Query patterns**:
  - filesystem-backed projection rebuilds
  - legacy-compatible issue inspection and migration flows

### Automations (Processors)

None. This feature changes command, event, and projection behavior only.

## Non-Goals
- Removing issue scope from attached documents.
- Preserving the old `task store ...` command family as a compatibility alias.
- Supporting arbitrary punctuation in path segments beyond alphanumeric, `_`, and `-`.
- Allowing `set` to write to subtree selectors (`foo/`) or to the root selector (`/`).
- Returning raw document content from `task show`; content retrieval remains the job of `task get`.
- Introducing non-string document payload types.

## Migration
A migration is required for existing attached-document history and projections.

- Existing canonical attached-content events keyed by `(store, key)` must be rewritten or backfilled into the new path-based event model using the canonical path `<store>/<key>`.
- Existing current-view projections must be rebuilt so visible materialized files move from `<store>/<key>` to `<store>/<key>.md`.
- Existing delete/finalization history must preserve semantics when converted from store/key identity to full-path identity.
- Legacy tracker import must map old mutable store files to path-based document revision 1 entries using the same `<store>/<key>` rule.
- No CLI compatibility alias is provided for `task store ...`; after migration, the supported surface is `task set/get/delete`.

## Verification Contract

### Setup / Preconditions
- A repo with the task tracker initialized and at least one open issue.
- At least one issue in `research` phase for first-save and finalization checks.
- For revision tests, an issue that can be advanced to a later configured phase.
- For migration checks, a fixture with existing `(store, key)` data or legacy imported issue content.

### User-Observable Proof
A CLI user can:
1. save nested content with `task set <issue-id> --key research/notes/today --value "hello"`
2. read it back with `task get <issue-id> --key research/notes/today`
3. save both `research` and `research/notes/today` and observe that both coexist in the returned tree
4. read a subtree with `task get <issue-id> --key research/` and see a recursive `value`/`entries` payload
5. read the full document tree with `task get <issue-id> --key /`
6. delete an exact path with `task delete <issue-id> --key research`
7. delete a subtree with `task delete <issue-id> --key research/`
8. advance the issue phase and observe that later saves to the same path create a new revision rather than mutating finalized history

Primary failure signals:
- invalid keys such as `/research`, `research//today`, `research/../today`, or bad segment characters are rejected clearly
- subtree and exact reads/deletes do not distinguish correctly
- `research` cannot coexist as both a document and subtree root
- a later-phase save overwrites prior finalized content instead of creating a new revision

### Automated Proof
Automated proof must cover:
- CLI parsing and registration for `task set`, `task get`, and `task delete`
- path validation rules, including exact selectors, subtree selectors, and `/`
- exact read, subtree read, and full-tree read output shape
- coexistence of `<path>.md` and `<path>/...`
- exact delete, subtree delete, and full-tree delete semantics
- phase-change finalization of open path-based drafts
- revision superseding for the same path across phases
- migration from old `(store, key)` history into path-based history
- legacy import mapping old store files to `<store>/<key>` logical paths

At least one end-to-end CLI regression should prove the full path:
save nested content → read exact value → read subtree → delete subtree → confirm removal.

### Fast Recheck
During implementation, rerun the focused Bun test coverage for document commands, document projection/folding behavior, phase finalization, and migration/import behavior. Before the work is considered complete, rerun the full project gates: `bun test` and `bun run typecheck`.

## Manual QA Intent

### Primary flows to verify
- Saving, reading, and deleting nested issue documents from the CLI.
- Coexistence of a path as both a document and a subtree root.
- Reading a subtree and the full tree with the expected recursive shape.

### Risky surfaces
- Path validation edge cases.
- Exact vs subtree selector handling.
- Phase-change finalization and later-phase resaves of the same path.
- Migration of existing attached content into the new path-based model.

### Required setup
- An issue with attached documents at multiple nested paths.
- A second issue or later phase transition scenario to verify revision behavior.
- A migration fixture with legacy or canonical pre-path content.

### Human checks
- CLI help/examples read naturally and no longer expose `store`.
- Returned JSON shape is understandable and consistent across exact, subtree, and root reads.
- Delete behavior feels unsurprising for exact paths, subtree selectors, and `/`.

## Open Questions
None.
