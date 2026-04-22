---
name: 04-migration-and-import
role: coder
depends_on:
  - 01-document-model-core
  - 03-projections-and-phase
---

# 04 — Migration, import, and finish verification

## Goal
Preserve existing attached-document history by mapping old `(store, key)` data to canonical paths, update legacy import to emit path-based document events, and finish branch-ready verification for the issue.

## Context
The approved plan explicitly includes migration from existing canonical `(store, key)` history and import mapping from legacy mutable store files. This task closes the rollout gap and proves the new model works end to end.

## Files
- `src/tracker/migrate.ts`
- any legacy-history compatibility logic in tracker readers/folders/projectors
- import and migration tests under `src/`
- docs/tests touched by the new command surface as needed

## Verification Tests
- focused Bun tests for old canonical store events mapping to `<store>/<key>` logical paths
- focused Bun tests for legacy import producing path-based document events and visible document reads
- final full-project verification: `bun test`, `bun run typecheck`, project lint, and diff lint

## Out of Scope
- new product behavior beyond the approved plan

## UI Scope Guardrails
None

## Done When
- old canonical store history is readable through the new path-based document surface without a CLI alias
- legacy import maps old store files to `<store>/<key>` logical paths
- full-project automated verification is green for the completed issue state
