# Critical Invariants / Observability Analysis

Use this reference when work may affect:
- core business invariants
- safety or authorization invariants
- workflow state guarantees
- auditability, logs, metrics, or diagnostics
- how failures are detected, explained, or verified after rollout

## Required outputs

When relevant, every feature spec, diagnosis, or refactor plan must include
explicit sections for:
- critical invariants
- observability / diagnostics

Do not bury these inside generic validation or testing prose.

## Scan-first presentation

Lead each section with a compact summary table, then expand only the rows that
matter.

### Critical Invariants summary table

| Invariant | Why it matters | Current enforcement | Proposed / preserved enforcement | Failure consequence |
|---|---|---|---|---|
| `Signer cannot sign another signer's locations` | signing integrity | token hook + signing rules | `same` | invalid signature state |

### Observability / Diagnostics summary table

| Surface | Signal | Current | Proposed / preserved | Used by whom |
|---|---|---|---|---|
| `CompleteSigning processor` | structured error log | `same` | `+metric complete_signing_failures` | ops + debug |

## What to cover

### 1. Critical Invariants

State:
- the invariant itself
- why it matters
- where it is currently enforced
- whether enforcement changes or must stay identical
- what breaks if the invariant is violated

Candidates include:
- access or visibility guarantees
- signer safety rules
- workflow stage monotonicity
- one-command / one-event intent preservation
- idempotency or no-duplication guarantees

### 2. Observability / Diagnostics

State:
- logs, metrics, traces, audit surfaces, or health checks involved
- what signal proves success or failure
- whether current signals are sufficient
- what new signals are needed
- who uses the signal: QA, ops, developers, support, or users

## Output quality bar

A plan is not ready if it only says:
- "keep invariants the same"
- "add logging"
- "should be observable"
- "monitor this"

Instead, spell out:
- which invariant matters
- where it is enforced
- what signal exists or must be added
- who would notice the problem and how
