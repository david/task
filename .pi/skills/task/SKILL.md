---
name: task
description: Use the `task` CLI from `PATH` correctly for creating, inspecting, updating, phasing, relating, closing, and attaching documents to issues. Use when an LLM needs to operate on `.task/` data without hand-editing tracker files, choose between metadata vs documents, or avoid common command and workflow mistakes.
---

# Task

Use the `task` CLI from `PATH` instead of manually editing `.task/`.

Read `references/usage-rules.md` before acting.
Read `references/examples.md` when you need concrete command shapes.

## Goal

Pick the right supported `task` command, preserve tracker invariants, and avoid unsafe shortcuts.

## Default workflow

1. Resolve context first with inspection commands.
2. Choose the narrowest correct command for the intent.
3. Prefer issue documents for larger notes, plans, logs, or generated artifacts.
4. Preserve the CLI's JSON-first behavior.

## Command selection

- Create issue: `task create`
- Inspect issues: `task show`, `task list`, `task search`
- Inspect hierarchy: `task children`, `task parents`, `task related`
- Advance workflow: `task phase next`, `task phase set`
- Edit non-reserved scalar metadata: `task meta get`, `task meta set`
- Edit labels or refs arrays: `task update label`, `task update refs`
- Write/read/delete issue documents: `task set`, `task get`, `task delete`
- Close an issue: `task close`
- One-time legacy migration only: `task legacy import`

## Hard rules

- Use `task` from `PATH`.
- Use `--flag value`, never `--flag=value`.
- Do not hand-edit `.task/` unless the user explicitly asks.
- Do not use `task meta set` for reserved workflow fields such as `phase`, `status`, or `parentId`.
- Do not model local hierarchy through `refs`; use `task create --parent <id>`.
- `task set` accepts exact document paths only. Trailing-slash subtree selectors like `research/` and `/` are for `task get` and `task delete`, not `task set`.
- `task meta set` writes raw strings. Be careful with structured or numeric fields, especially `priority`.
- `task list` and `task search` exclude closed issues unless `--all` is passed.
- Prefer the supported commands documented in `../../doc/commands.md`; do not invent undocumented commands.

## When to stop and ask

Ask instead of guessing when:
- the intended relationship should be parent/child vs `refs`
- content might belong in metadata or in an issue document
- a metadata write could cause type drift or overwrite structured content
- the user appears to want a workflow/schema change rather than normal issue operations

## Primary references

- `../../AGENTS.md`
- `../../doc/commands.md`
- `../../doc/project-management.md`
- `../../doc/architecture.md`
