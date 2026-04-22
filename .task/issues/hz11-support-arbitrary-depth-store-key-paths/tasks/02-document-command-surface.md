---
name: 02-document-command-surface
role: coder
depends_on:
  - 01-document-model-core
---

# 02 — Document command surface

## Goal
Expose the new issue document model through `task set`, `task get`, and `task delete`, and remove the `task store ...` command family from the in-progress `src/` CLI surface.

## Context
Once the core model supports path-based documents, the user-facing CLI must switch to the approved command family and selector syntax. This task owns parsing, registration, help text, and command-level behavior proofs.

## Files
- `src/commands.ts`
- `src/commands-registry.ts`
- `src/task.ts`
- `src/task.test.ts`
- command-level tests for set/get/delete behavior

## Verification Tests
- focused Bun tests for command registration, help output, exact-path set/get/delete, subtree delete, and root reads
- at least one end-to-end CLI regression: save nested content → read exact → read subtree → delete subtree → confirm removal

## Out of Scope
- projection materialization layout changes
- migration/import behavior
- later-phase revision superseding beyond what the core task already enables

## UI Scope Guardrails
- only change command names, flags, and examples required for the approved document-key surface
- do not introduce extra aliases beyond the approved commands

## Done When
- `src/` command registration exposes `set`, `get`, and `delete` with the approved `--key` selector rules
- `task store ...` is no longer part of the `src/` CLI help/registry
- command-level tests and CLI help assertions pass
