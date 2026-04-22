# Esther Filesystem Adapter Specification

## Goal

Provide a generic filesystem-backed adapter for Esther that can serve as a durable event store for repo-local, append-only systems such as `task`.

The adapter must make the filesystem the persistence layer while preserving core event-store guarantees:
- append-only writes
- deterministic per-stream ordering
- optimistic concurrency
- durable reads after successful append
- rebuildable projections built on top of the event log

This adapter is a library-level Esther primitive, not a task-specific abstraction.

## Non-Goals

- Providing a database-like query engine
- Owning task-specific projections, hierarchy logic, or workflow config
- Hiding the filesystem layout from library authors completely; the layout should be stable and documented
- Supporting remote multi-writer coordination across machines
- Solving git merge conflicts for concurrent writes to the exact same stream revision

## Storage Model

The adapter stores events as immutable JSON files under a configured root directory.

### Concepts
- **Store root**: top-level directory managed by the adapter
- **Stream**: ordered append-only sequence of events for a single aggregate or entity
- **Commit**: one atomic append operation containing one or more events
- **Projection/checkpoint data**: optional rebuildable state stored separately from stream data

### Recommended layout

```text
<root>/
  streams/
    <stream-kind>/
      <stream-id>/
        stream.json
        commits/
          0000000000000001.json
          0000000000000002.json
  checkpoints/
    <consumer-name>.json
  projections/
    ... adapter-managed only if projection helpers are enabled ...
  tmp/
```

### Stream metadata file

Each stream directory contains a `stream.json` file with the current known head:

```json
{
  "streamId": "ab12",
  "streamKind": "issue",
  "version": 7,
  "createdAt": "2026-04-17T16:00:00.000Z",
  "updatedAt": "2026-04-17T16:10:00.000Z"
}
```

This file is a cache/index, not the canonical event history. The canonical history is the ordered set of commit files.

### Commit file format

Each successful append creates exactly one immutable commit file.

Filename:
- zero-padded monotonically increasing stream commit number
- example: `0000000000000003.json`

File contents:

```json
{
  "commitId": "01JS1J7J9XV9E1H3C9K2W7N8YQ",
  "streamId": "ab12",
  "streamKind": "issue",
  "expectedVersion": 5,
  "fromVersion": 6,
  "toVersion": 7,
  "recordedAt": "2026-04-17T16:10:00.000Z",
  "events": [
    {
      "eventId": "01JS1J7JAH4D3QPRD8EMQ1VK3F",
      "eventType": "IssuePhaseChanged",
      "eventVersion": 1,
      "streamVersion": 6,
      "payload": {
        "from": "research",
        "to": "spec"
      },
      "metadata": {
        "actor": "task"
      },
      "recordedAt": "2026-04-17T16:10:00.000Z"
    },
    {
      "eventId": "01JS1J7JB0W8EY5TT8AH9YQYV0",
      "eventType": "StoreRevisionFinalized",
      "eventVersion": 1,
      "streamVersion": 7,
      "payload": {
        "store": "research",
        "key": "prd.md",
        "revision": 1
      },
      "metadata": {
        "actor": "task"
      },
      "recordedAt": "2026-04-17T16:10:00.000Z"
    }
  ]
}
```

Rules:
- `events[]` order is authoritative within the commit
- `streamVersion` values must be contiguous across the stream
- commit files are immutable once written
- commit file names must be contiguous within a stream

## Required Adapter API

The exact names may follow Esther conventions, but the adapter must provide equivalents of the following operations.

### 1. Append to stream

```ts
append(options: {
  streamKind: string
  streamId: string
  expectedVersion: number | "no_stream" | "any"
  events: Array<{
    eventType: string
    eventVersion?: number
    payload: unknown
    metadata?: Record<string, unknown>
    eventId?: string
    recordedAt?: string
  }>
}): Promise<{
  streamKind: string
  streamId: string
  fromVersion: number
  toVersion: number
  commitId: string
  eventIds: string[]
}>
```

Behavior:
- validates optimistic concurrency against the current stream head
- writes all events from one append as one atomic commit
- assigns missing event IDs and timestamps
- assigns contiguous stream versions
- returns the new stream range

Error cases:
- `ConcurrencyError` when `expectedVersion` does not match current head
- `InvalidStreamIdError`
- `InvalidStreamKindError`
- `EmptyCommitError`
- `SerializationError`
- `FilesystemWriteError`

### 2. Read one stream

```ts
readStream(options: {
  streamKind: string
  streamId: string
  fromVersion?: number
  toVersion?: number
}): AsyncIterable<EventEnvelope>
```

Behavior:
- yields events in stream order
- supports partial reads by version range
- returns an empty iterator for a missing stream

### 3. Read stream head

```ts
readHead(options: {
  streamKind: string
  streamId: string
}): Promise<{
  version: number
  exists: boolean
}>
```

Behavior:
- reads the latest known stream version
- may use `stream.json`
- if `stream.json` is missing or stale, implementation may rebuild from commit files

### 4. Stream existence check

```ts
streamExists(options: {
  streamKind: string
  streamId: string
}): Promise<boolean>
```

### 5. List streams by kind

```ts
listStreams(options: {
  streamKind: string
  cursor?: string
  limit?: number
}): AsyncIterable<{
  streamId: string
  version: number
}>
```

Behavior:
- supports projectors and administrative tooling
- order should be stable and deterministic
- pagination may be simple lexicographic cursoring

### 6. Read all events

```ts
readAll(options?: {
  after?: GlobalPosition
  limit?: number
}): AsyncIterable<EventEnvelopeWithPosition>
```

This is strongly recommended, even if implemented by scanning stream directories, because projectors often need a global feed.

If Esther’s current model does not require a global feed, this may be deferred, but the filesystem layout should leave room for it.

### 7. Checkpoint store

Either inside the same adapter package or as a sibling adapter, Esther should expose a simple checkpoint store:

```ts
loadCheckpoint(name: string): Promise<Checkpoint | null>
saveCheckpoint(name: string, checkpoint: Checkpoint): Promise<void>
```

Checkpoint shape:

```ts
type Checkpoint = {
  name: string
  position: string
  updatedAt: string
  metadata?: Record<string, unknown>
}
```

This is needed for rebuildable projections.

## Event Envelope Shape

The adapter should expose a normalized read shape like:

```ts
type EventEnvelope = {
  eventId: string
  eventType: string
  eventVersion: number
  streamKind: string
  streamId: string
  streamVersion: number
  payload: unknown
  metadata: Record<string, unknown>
  recordedAt: string
}
```

For global feeds:

```ts
type EventEnvelopeWithPosition = EventEnvelope & {
  globalPosition: string
}
```

## Atomicity and Durability

The adapter must guarantee that a successful append is never partially visible.

### Required write algorithm

For each append:
1. read current stream head
2. validate `expectedVersion`
3. build the full commit payload in memory
4. write commit JSON to a temp file under `<root>/tmp/`
5. fsync the temp file
6. rename the temp file into the target commit path
7. update `stream.json` via temp-file-and-rename
8. return success only after the commit file and stream metadata are durable enough for subsequent reads in the same process

If the process crashes:
- before rename: no commit is visible
- after commit rename but before `stream.json` update: commit is authoritative; head can be rebuilt from commits

## Concurrency Model

The adapter must support optimistic concurrency for single-machine local writers.

### Required semantics
- appends to the same stream must use `expectedVersion`
- if the stream head changed since the caller last read it, append fails with `ConcurrencyError`
- appends to different streams must not interfere with each other

### Locking

Implementation options:
- lock file per stream during append, or
- atomic directory creation as a mutex, or
- another local-filesystem-safe locking mechanism

Requirements:
- no global process-wide lock for all streams
- locking scope must be one stream at a time
- stale locks must be recoverable

## Validation Rules

The adapter must validate:
- `streamKind` contains only safe path characters
- `streamId` contains only safe path characters
- commit files are contiguous and non-duplicated
- events in a commit have contiguous `streamVersion`
- commit `fromVersion` / `toVersion` match the event range

Recommended safe name regex:
- `^[a-zA-Z0-9][a-zA-Z0-9_.-]*$`

Reject:
- path traversal (`..`)
- path separators
- empty strings

## Serialization Rules

- encoding: UTF-8
- format: canonical JSON with stable key order where practical
- timestamps: ISO-8601 UTC strings
- event IDs and commit IDs: ULID preferred
- payloads and metadata must be JSON-serializable

The adapter should allow a pluggable serializer if Esther already supports one, but JSON must be the default.

## Recovery and Integrity

The adapter must be able to detect and recover from incomplete metadata state.

### Required recovery behavior
- if `stream.json` is missing, rebuild head from commit files
- if `stream.json` version disagrees with commit files, prefer commit files and rewrite metadata
- ignore temp files in `tmp/`
- surface a clear integrity error if commit numbering has gaps

### Optional integrity tools
- `verifyStore(root)`
- `repairStream(streamKind, streamId)`
- `rebuildHeads()`

These are useful but not required for v1.

## Performance Requirements for v1

The adapter should optimize for correctness and simplicity over maximum throughput.

Expected acceptable characteristics:
- efficient append and read for individual streams
- acceptable stream listing for small to medium repos
- full rebuilds may be linear scans
- no database dependency

Not required for v1:
- compaction
- snapshots
- segment merging
- background vacuuming

## Projection/Materialization Support

This adapter does not own domain projections, but it should be friendly to projectors.

Recommended helper APIs:

```ts
withCheckpointedFeed(options: {
  consumer: string
  handler: (event: EventEnvelopeWithPosition) => Promise<void>
}): Promise<void>
```

Or equivalent library utilities that combine:
- `readAll`
- checkpoint load/save
- exactly-once-ish sequential processing within one process

## Filesystem Layout Stability

The on-disk layout should be considered part of the adapter contract.

It should be:
- documented
- deterministic
- safe to inspect manually
- stable across patch releases

Breaking layout changes require an explicit migration path.

## Minimal v1 Scope

Esther filesystem adapter v1 should ship with:
- append to stream
- read stream
- read head
- stream existence check
- list streams by kind
- checkpoint persistence
- local optimistic concurrency
- documented on-disk format
- recovery from stale or missing stream metadata

Nice-to-have but optional in v1:
- global `readAll`
- integrity verification helpers
- projection helper utilities

## Why this shape fits `task`

This adapter is generic, but it directly supports the task tracker design:
- one task issue can map to one Esther stream
- appends are immutable JSON commits
- different issues write to different stream directories, reducing conflicts
- phase transitions can append multiple events atomically in one commit
- current-state indexes can be rebuilt from the canonical stream data

## Open Design Choice

The only notable choice to settle before implementation is whether Esther needs a **global event feed in v1**.

Recommendation:
- keep the internal layout compatible with a future global feed
- if easy, expose `readAll` in v1
- if not, do not block the adapter on a perfect global-position design; stream correctness matters more first
