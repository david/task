---
name: 03-projections-and-phase
role: coder
depends_on:
  - 01-document-model-core
  - 02-document-command-surface
---

# 03 — Projections and phase-aware documents

## Goal
Update issue projections to materialize hierarchical document paths as markdown files plus directories, surface current document keys in issue inspection, and preserve draft/finalization semantics by full path.

## Context
The product contract requires a path to behave as both a document and a subtree root, plus later-phase saves must supersede finalized history without mutating it. Those behaviors live in projection materialization and phase-aware revision handling.

## Files
- `src/tracker/projections.ts`
- `src/tracker/issues.ts`
- document state/materialization helpers
- `src/commands-meta-phase.test.ts`
- any show/projection tests under `src/`

## Verification Tests
- focused Bun tests for `<path>.md` plus child-directory coexistence
- phase-change finalization by full path
- later-phase resaves creating a superseding revision
- issue inspection showing current logical document keys instead of store indexes where appropriate

## Out of Scope
- migration/backfill from pre-path canonical history
- legacy import updates

## UI Scope Guardrails
None

## Done When
- projections materialize visible documents as `<path>.md` and nested directories
- a logical path may coexist as both a document and subtree root
- phase finalization and revision superseding work by full path
- focused projection/phase tests pass
