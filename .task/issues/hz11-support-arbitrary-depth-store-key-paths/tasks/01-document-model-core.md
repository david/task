---
name: 01-document-model-core
role: coder
depends_on: []
---

# 01 — Document model core

## Goal
Replace the tracker's internal `(store, key)` identity with canonical issue document paths and add core save/read/delete capabilities for exact paths, subtree selectors, and the root selector.

## Context
The approved plan moves the product from `store + key` to a single hierarchical document path. The foundation must exist in schemas, events, folding, and tracker issue helpers before the CLI surface or projections can switch cleanly.

## Files
- `src/tracker/schemas.ts`
- `src/tracker/event-core.ts`
- `src/tracker/event-parsers.ts`
- `src/tracker/event-fold.ts`
- `src/tracker/issues.ts`
- `src/tracker/stores.ts` or replacement document-state helpers
- focused tests under `src/` for core document behavior

## Verification Tests
- focused Bun tests covering path validation, exact-path saves, exact/subtree/root reads, and exact/subtree/root delete semantics at the tracker-command layer
- confirm missing selectors return an empty tree rather than throwing

## Out of Scope
- CLI help/registration changes
- projection materialization changes to `.md` files
- legacy-history migration/import behavior

## UI Scope Guardrails
None

## Done When
- canonical document events and payloads use full paths instead of `(store, key)`
- tracker helpers can save, read, and delete exact paths, subtrees, and the full tree
- path validation enforces the approved segment rules and selector forms
- focused tests for the new core behavior pass
