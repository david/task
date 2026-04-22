# Event / Contract / Validation Analysis

Use this reference when a feature, bugfix plan, or refactor may affect:
- event names, versions, payloads, or consumers
- request / response / exception boundary shapes
- validation placement, ownership, or failure behavior

## Required outputs

Every relevant artifact must make these impacts explicit instead of implying them.
Lead with compact summary tables, then follow with the detailed shapes and notes.

## Scan-first presentation

Start each relevant section with a compact table before the longer bullets or
code blocks.

## Canonical delta notation

Use a small, consistent notation in summary tables:
- `+field` — added
- `-field` — removed
- `~field` — changed shape, meaning, source, or semantics
- `validated(field)` — same field exists, but validation becomes stricter or newly explicit
- `same` — no relevant change
- `split(a->a,b)` — one field becomes multiple fields
- `merge(a,b->c)` — multiple fields become one field
- `renamed(old->new)` — name changed with equivalent meaning unless otherwise noted

Use comma-separated entries, for example:
- payload delta: `+packetId, ~status, renamed(actorId->createdByUserId)`
- validation delta: `validated(email), +cross-aggregate org check, same authz`
- field columns: `+name`, `-legacyStatus`, `~deliveryMethod`, `validated(name)`

If there is no meaningful change, write `same` rather than leaving the cell ambiguous.

### Event Delta summary table

| Event | Status | Producer | Consumers affected | Payload delta | Validation delta | Replay / migration |
|---|---|---|---|---|---|---|
| `ExampleEvent` | `new event` | `CreateThing` | `ThingProjector`, `NotifyThingProcessor` | `+thingId, +createdByUserId` | `validated(thingId)` | replay-safe, no backfill |

### Boundary Contract Delta summary table

| Boundary | Kind | Schema / parser owner | Consumers affected | Added | Removed | Changed | Newly validated |
|---|---|---|---|---|---|---|---|
| `POST /api/things` request body | request | `shared/src/schemas/...` | frontend form, CLI | `+name` | `same` | `~status` | `validated(name)` |

### Validation Matrix summary table

| Flow / boundary | Raw input source | Boundary parser | Domain invariants | Cross-aggregate checks | Failure shape | Validation owner |
|---|---|---|---|---|---|---|
| `CreateThing` | HTTP body | `CreateThingRequestSchema` | `validated(name)` | `+org exists` | `name_required` | route + `webData` + handler |

### 1. Event Delta

For every touched event, state it once in the summary table, then expand it in detail:
- **Event**: `<EventName>`
- **Status**: `unchanged`, `new event`, `new version of <OldEvent>`, or `consumer-only change`
- **Producer**:
- **Consumers affected**:
- **Current payload**:
  ```ts
  // current serialized event payload shape
  ```
- **Proposed payload**:
  ```ts
  // proposed serialized event payload shape
  ```
- **Validation assumptions**:
- **Replay / migration notes**:

Do not say "we'll change the event" without classifying whether it is:
- a completely new event
- a versioned successor to an existing event
- or no event-shape change at all

When the repo is event-sourced and the meaning or serialized payload changes incompatibly, prefer a new event version over mutating a historical event in place.

### 2. Boundary Contract Delta

For every touched boundary, state the exact before / after shape.

Cover as applicable:
- request params
- request query
- request body
- response body
- error / exception payloads
- event payloads
- internal command shape when it materially differs from the request

For each contract, show:
- **Boundary**:
- **Current shape**:
  ```ts
  // current shape
  ```
- **Proposed shape**:
  ```ts
  // proposed shape
  ```
- **Field changes**: added / removed / changed / unchanged-but-newly-validated
- **Schema / parser owner**:
- **Consumers affected**:

Prefer exact field lists or code blocks over prose summaries. For scanability, put the compact table first and the code blocks immediately after it.

### 3. Validation Matrix

For every affected flow, put one row in the validation matrix, then expand only the rows that need more detail.

Cover:
- **Raw input source**
- **Boundary parser / schema**
- **Domain invariants**
- **Cross-aggregate validation**
- **Authorization-sensitive validation**
- **Processor / projector assumptions**
- **Failure result**: exception name, response status, error payload, or rejected command outcome
- **Validation owner**: route edge, shared schema, `webData`, handler, projector, processor, or client

Distinguish clearly between:
- shape validation at the boundary
- domain validation inside trusted code
- cross-aggregate checks before pure handlers
- replay compatibility requirements for historical events

## Research expectations

When the repo has event-sourcing, backend-conventions, schema, or code-style docs, read the relevant ones before proposing event, contract, or validation changes.

During research, identify:
- existing event names and versions
- all known consumers of touched events
- current request / response schemas
- current event payload types
- where each relevant validation currently lives
- whether the current behavior already matches the requested change

## Output quality bar

A plan is not ready if it says any of the following without specifics:
- "update the event"
- "adjust the API"
- "add validation"
- "tighten the schema"
- "keep behavior the same"

Instead, spell out:
- which event changes, and whether it is new or versioned
- which request / response / event fields change
- which validation rule moves, is added, is removed, or stays the same
- who observes the failure and in what exact shape
- the same information in compact summary tables before the detailed writeup
- canonical delta notation such as `+field`, `-field`, `~field`, `validated(field)`, and `same`
