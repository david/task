# Project management

This repo's main product is a local issue tracker. Use this doc when you need to decide how to represent work inside issue metadata and stores.

## Standard issue shape

The CLI creates issues with these defaults:

- `status: open`
- `phase: research`
- `priority: 2`
- `refs: []`
- `labels: []`

Recommended standard fields:

- `title` — short human-readable summary
- `description` — brief problem statement
- `phase` — current workflow stage
- `priority` — urgency, where lower numbers are higher priority
- `labels` — stable tags used for filtering
- `refs` — external references or non-hierarchy links
- `github_issue` — upstream GitHub issue number when applicable

## Recommended workflow

1. Create an issue with the title, initial priority, and labels.
2. Keep high-signal summary fields in `issue.json`.
3. Put larger notes, plans, or research into stores.
4. Use `task create --parent <id>` for local parent/child hierarchy. Keep `refs` for external or non-hierarchy links.
5. Advance workflow with `task phase next` / `task phase set`, not `meta set --key phase`.
6. Close issues with `task close`; do not manually move or archive issue directories.

## Phase conventions

Workflow phases come from `.task/settings.json`:

- `defaultPhase` chooses the phase for newly created issues
- `phases` declares the allowed phase names
- `transitions` declares which next phases are valid from each current phase

Use `task phase next <id>` to read the configured next phase and `task phase set <id> --value <phase>` to advance an issue. `meta set` must not be used for reserved workflow fields like `phase`.

## Priority conventions

- `0` = highest urgency
- larger numbers = lower urgency
- default = `2`

Prefer setting numeric priority at creation time. There is no typed priority update command yet, so changing it later through `meta set` can accidentally convert the field from number to string.

## Refs conventions

Use `refs` for:

- external URLs or ticket IDs when a local issue does not exist
- non-hierarchy local references that should not affect `children`, `parents`, or `related`

Use `task create --parent <id>` for local hierarchy. Relationship commands read hierarchy state from canonical issue events rather than inferring parents from `refs`.

## Labels conventions

Use labels for durable filtering dimensions, not transient state. Good examples:

- subsystem (`cli`)
- work type (`bug`)
- topic (`migration`)

Avoid encoding workflow stage in labels when `phase` already carries that meaning.

## When to use stores

Use stores for content that is too large or too structured for metadata fields, such as:

- research notes
- implementation plans
- copied logs or repro steps
- generated artifacts that should stay attached to the issue

A store is a directory inside the issue directory. A key is a file inside that store.

Store writes are append-only in canonical history:

- `task store set` writes a draft revision for the issue’s current phase
- `task phase set` finalizes every open draft revision on that issue
- later `task store set` calls for the same store/key create a new revision in the new phase instead of mutating finalized content
- `task store get` and `task store keys` show only the latest current view

Example:

```bash
task store set ab12 --store research --key summary --file /tmp/summary.md
```

## Store naming rules

Store names and keys must be path-safe:

- allowed characters: letters, numbers, `_`, `.`, `-`
- disallowed: path separators and `..`

Do not bypass these rules with manual file writes.

## Avoid manual edits unless necessary

The CLI expects a stable on-disk layout. Prefer commands over hand-editing files, especially for:

- closing issues by hand-editing projections or moving directories
- changing phase
- updating labels or refs
- writing store contents

If you must edit `issue.json` manually, preserve valid JSON and existing field meanings.
