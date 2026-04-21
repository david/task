# Project management

This repo's main product is a local issue tracker. Use this doc when you need to decide how to represent work inside issue metadata and issue documents.

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
3. Put larger notes, plans, or generated artifacts into issue documents.
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

## When to use issue documents

Use issue documents for content that is too large or too structured for metadata fields, such as:

- research notes
- implementation plans
- copied logs or repro steps
- generated artifacts that should stay attached to the issue

A document path is a slash-delimited logical key inside the issue, such as `research/summary` or `qa/results/run-1`.

Use exact paths for writes and exact, subtree, or root selectors for reads and deletes:

```bash
task set ab12 --key research/summary --file /tmp/summary.md
task get ab12 --key research/
task delete ab12 --key /
```

Document writes are append-only in canonical history:

- `task set` writes a draft revision for one exact document path on the issue’s current phase
- `task phase set` finalizes every open draft revision on that issue
- later `task set` calls for the same document path create a new revision in the new phase instead of mutating finalized history
- `task get` returns the latest visible view for an exact path, subtree, or the full tree
- `task show --include-keys` lists the current logical document paths

## Document path rules

Document selectors must stay path-safe:

- exact path segments may use letters, numbers, `_`, and `-`
- use `/` between segments to nest documents
- exact write paths may not start or end with `/`
- subtree selectors add a trailing `/`; `/` alone selects the full tree for `get` or `delete`
- empty segments and `..` are invalid

Do not bypass these rules with manual file writes.

## Avoid manual edits unless necessary

The CLI expects a stable on-disk layout. Prefer commands over hand-editing files, especially for:

- closing issues by hand-editing projections or moving directories
- changing phase
- updating labels or refs
- writing or deleting documents by hand inside `.task/issues/`

If you must edit `issue.json` manually, preserve valid JSON and existing field meanings.
