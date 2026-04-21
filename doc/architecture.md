# Architecture

Root scope: this document covers the supported `task` CLI surface in the repository root. `packages/esther/` is a separate nested project with its own docs and should not be treated as part of the root CLI architecture. Do not modify `packages/esther/` from root-task work unless the user explicitly asks for Esther changes.

## What this project is

`task` is a Bun/TypeScript CLI for managing local issues for agents. It stores tracker state inside the current repo under `.task/`.

Use `bin/task` for normal CLI usage, or run `bun task.ts` directly from the repo root. The supported repo-root entrypoint delegates command registration and behavior through the shared `src/` implementation so help, docs, and command behavior stay aligned.

## Repository layout

- `bin/task` — supported shell wrapper that runs `bun task.ts`
- `task.ts` — supported repo-root CLI entrypoint: parses argv, prints help, normalizes positional issue IDs, and dispatches through the shared command registry
- `src/commands-registry.ts` — authoritative command registration, help text, and examples for the current CLI surface
- `src/commands.ts` — issue operations and document-command implementations
- `src/types.ts` — command metadata types used by the dispatcher
- `src/tracker/root.ts` — repo-local tracker resolution plus Esther event/checkpoint store handles
- `src/tracker/issues.ts` — tracker-backed create/show/list/search helpers plus document read/write/delete flows
- `src/tracker/document-paths.ts` — exact-path vs subtree/root selector parsing for `task set`, `task get`, and `task delete`
- `task.test.ts` — repo-root help, subprocess CLI, and supported-doc parity tests
- `src/*.test.ts` — command semantics, tracker behavior, and document-path regression coverage

## Runtime flow

1. `bin/task` invokes `bun task.ts`.
2. `task.ts` parses argv into a flag map.
3. It resolves a one-word or two-word command from `src/commands-registry.ts`.
4. It normalizes positional issue IDs into `--id` for commands that support them.
5. The command implementation in `src/commands.ts` resolves the repo-local tracker from the working directory and returns plain JSON-compatible data.
6. Tracker helpers read and append canonical Esther event files under `.task/events/`, then rebuild or read projections under `.task/issues/`, `.task/indexes/`, and `.task/checkpoints/`.
7. `task.ts` serializes the result to JSON, or JSONL for array results when `--jsonl` is set.
8. Errors are emitted as JSON on stderr and the process exits with status 1.

## Storage model

Tracker data lives under the current repo:

- `.task/events/` — canonical Esther event files
- `.task/indexes/` — rebuildable Esther tag indexes and task-owned current-state indexes
- `.task/checkpoints/` — rebuildable checkpoint state
- `.task/issues/` — current issue projections and visible document materializations
- `.task/issues/.archive/` — archived issue projections

Each issue projection directory is still named `<id>-<slug>`.

Inside an issue projection directory:

- `issue.json` — current metadata projection
- `<document path>.md` — visible materialization of a logical document path such as `research/summary.md`
- nested directories under `.task/issues/<id>-<slug>/` materialize document subtrees as needed

A logical path may exist both as a document and as a subtree root. For example, `research` can materialize as `research.md` while nested documents such as `research/notes/today` materialize under `research/notes/today.md`.

For core create/show/list/search flows, canonical Esther event files under `.task/events/` are the source of truth. Projections are rebuildable.

## Issue metadata conventions

Standard fields currently used by the CLI:

- `title`
- `description`
- `status` (`open` / `closed` by convention)
- `phase` (`research` by default; other values come from workflow settings)
- `priority` (number, lower is more urgent; default `2`)
- `created`
- `updated`
- `refs` (external references or non-hierarchy links)
- `labels`
- `github_issue` (optional number)

Important: the code does not enforce a full metadata schema. New or modified behavior should preserve these conventions and avoid introducing silent type drift.

## Design constraints

- The CLI is intentionally machine-oriented: output is JSON first, not pretty terminal prose.
- The repo-root command layer is thin; command metadata lives in `src/commands-registry.ts` and behavior lives in `src/commands.ts`.
- File-system interactions are the main boundary. Path safety and predictable file layout matter more than API convenience.
- Tracker resolution is repo-local: commands operate on the current repo, not on a shared home-directory store.
- Hierarchy is explicit: parent/child relationships come from canonical issue events and hierarchy projections, not from `refs`.
- Closing an issue appends `IssueClosed` and archives the projection; the project does not have a separate delete command for issues.

## When changing behavior

Open this doc first when you need to:

- add a command
- change issue storage layout
- change JSON output contracts
- understand where active vs archived issues come from
- confirm how logical document paths are materialized on disk
- avoid drifting into `packages/esther/` by mistake

## If you add a command

Update all of these together:

- implementation in `src/commands.ts`
- registration and help metadata in `src/commands-registry.ts`
- tests in `src/*.test.ts` and/or `task.test.ts`
- supported docs in `doc/` and `src/doc/` when the user-facing contract changes
