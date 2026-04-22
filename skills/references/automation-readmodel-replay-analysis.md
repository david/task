# Automations / Read Models / Replay Analysis

Use this reference when work may affect:
- processors, automations, or emails
- side effects triggered by events
- read models, projectors, lists, queries, or derived views
- replay compatibility, event history rebuilds, or migrations

Before proposing changes, read the repo's event-sourcing and backend conventions
when they are relevant.

## Required outputs

When relevant, every feature spec, diagnosis, or refactor plan must include
explicit sections for:
- automations / side effects
- read model / query impact
- migration / replay impact

Do not bury these inside generic implementation prose.

## Scan-first presentation

Lead each section with a compact summary table, then expand only the rows that
matter.

### Automations / Side Effects summary table

| Trigger | Automation / Processor | Side effect | Current | Proposed | Idempotency / retry | Failure handling |
|---|---|---|---|---|---|---|
| `PacketSubmitted` | `SendSubmissionEmail` | email send | `same` | `+cc tc` | `same` | `retry-safe` |

### Read Model / Query summary table

| View / Query | Source events | Current | Proposed | Scope / filter impact | Consumers affected |
|---|---|---|---|---|---|
| `listPacketSessions` | `PacketSessionCreated`, `PacketSubmitted` | `same` | `+stage` | `same` | frontend sessions page |

### Migration / Replay summary table

| Surface | Current | Proposed | Replay-safe | Migration / backfill | Deploy order |
|---|---|---|---|---|---|
| `PacketSubmittedV2` projector | old payload only | handle V1 + V2 | `yes` | `no backfill` | deploy projector before producer |

## What to cover

### 1. Automations / Side Effects

State:
- trigger event
- processor / automation name
- side effect performed
- current vs proposed behavior
- idempotency expectations
- retry behavior
- failure handling
- user-visible consequence

### 2. Read Model / Query Impact

State:
- read models or queries touched
- source events
- current vs proposed schema or shape
- filtering / sorting / scope changes
- consumers affected
- projector or query owner

### 3. Migration / Replay Impact

State:
- whether replay remains safe
- whether historical events need special handling
- whether a projector update, rebuild, or backfill is required
- whether deploy order matters
- whether a new event version changes compatibility expectations

## Output quality bar

A plan is not ready if it only says:
- "update the projector"
- "send an email"
- "adjust the list"
- "handle replay"

Instead, spell out:
- which automation or processor changes
- which read model or query changes
- whether replay is safe
- whether migration or deploy sequencing is required
