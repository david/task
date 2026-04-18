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
5. Close issues with `task close`; do not manually move directories.

## Phase conventions

`phase` is not schema-enforced, so consistency is a team rule. Current examples in the codebase use:

- `research`
- `ready-to-code`

If you introduce more phase names, keep them deliberate and reusable instead of inventing one-off values.

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

- archiving issues
- updating labels or refs
- writing store contents

If you must edit `issue.json` manually, preserve valid JSON and existing field meanings.
