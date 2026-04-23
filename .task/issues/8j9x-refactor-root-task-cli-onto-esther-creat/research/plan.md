---
kind: refactor
status: approved
---

# Approved Plan

## Scope
Refactor the root `task` CLI to use Esther's app/slice architecture while preserving current command behavior, tracker semantics, and repo-local filesystem persistence.

## Planned workstreams

1. **Bootstrap Esther app wiring**
   - add a root `createApp(...)` composition module
   - wire the existing filesystem event store through the app
   - add a CLI input adapter or one-shot dispatch binding that satisfies Esther's input-adapter contract

2. **Define filesystem-backed read models and projectors**
   - identify the current task read surfaces that need durable filesystem state
   - express them as Esther read models / projector bindings
   - persist projector results into `.task/issues/`, `.task/indexes/`, and related derived filesystem views through projection adapters

3. **Port CLI commands to slices**
   - move mutating command logic into `defineCommandSlice(...)`
   - move read paths to `defineQuerySlice(...)` or projection-backed query helpers
   - route parsed CLI input to `app.dispatch(...)`

4. **Remove bespoke orchestration after parity**
   - retire direct `eventStore.append(...)` command flows
   - retire ad hoc fold/rebuild code that the new slice/read-model flow supersedes
   - preserve only boundary code still needed for CLI parsing, output, and filesystem adaptation

## Protected contracts
- CLI grammar and JSON output stay stable
- canonical `.task/events/` history stays authoritative
- current issue, hierarchy, document, phase, and concurrency behavior stay stable
- rebuildable projections continue to recover from canonical history

## Verification Contract

### Automated proof
```bash
bun test
bun run lint
bun run typecheck
bun run /home/david/.pi/agent/skills/lint/scripts/lint.ts --diff
```

### Required focused proof
- parser coverage for mixed switch/positional commands
- create/show/list/search parity
- hierarchy query parity
- document lifecycle parity
- projection rebuild parity
- optimistic-concurrency parity

## Out of scope
- intentional CLI behavior redesign
- event-schema or tracker-layout changes that require migration unless split into a follow-up issue
- Esther work inside `packages/esther/` unless a later task explicitly scopes that package

Next: /skill:taskify 8j9x --from plan
