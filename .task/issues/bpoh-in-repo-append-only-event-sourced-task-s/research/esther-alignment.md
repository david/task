# Esther Alignment Notes

This issue originally assumed task would need a task-specific stream abstraction and a new Esther filesystem adapter spec.

That assumption is now obsolete.

Task should target Esther as implemented on `main` after commit `5d3c54bc5be8cce6dc951eb48763bc03edc635ec`.

## What task should use from Esther

- `createFilesystemEventStore(...)`
- `createFilesystemCheckpointStore(...)`
- `queryByTags(...) -> { state, maxPosition }`
- `append(events, { expectedPosition, boundaryTags })`
- tag-based canonical history
- one immutable JSON file per event

## What task should not introduce

- no separate task stream store
- no SQLite in v1
- no authoritative directory tree

## Canonical task boundary tags

- `issue:<id>` for issue-local history and optimistic concurrency
- `kind:issue` for issue events
- `parent:<id>` for hierarchy when applicable
- `store:<store>` for store-related events

## Materialized layout

Task may still materialize `.task` hierarchy/state/index files for:
- browsing
- short-id lookup
- search
- children/parents navigation
- current store content

Those materializations are projections only. Esther event files remain authoritative.
