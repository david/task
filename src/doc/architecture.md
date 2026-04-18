# Architecture

Staged scope: this document covers the in-progress `src/` rewrite of the `task` CLI. The legacy CLI still lives in the repository root while the new in-repo tracker work is being developed under `src/`. `packages/esther/` is a separate nested project with its own docs and should not be treated as part of the root CLI architecture. Do not modify `packages/esther/` from root-task work unless the user explicitly asks for Esther changes.

## What this project is

`task` is a Bun/TypeScript CLI for managing local issues for agents. It stores tracker state inside the current repo under `.task/`.

## Repository layout

- `src/task.ts` — CLI entrypoint: help text, argv parsing, command dispatch, output formatting, process exit behavior.
- `src/commands.ts` — all issue operations and command registration.
- `src/types.ts` — command metadata types used by the dispatcher.
- `src/bin/task` — shell wrapper that runs `bun src/task.ts`.
- `src/tracker/root.ts` — repo-local tracker resolution plus Esther event/checkpoint store handles.
- `src/tracker/events.ts` — task event shapes and issue-state folding helpers.
- `src/tracker/issues.ts` — tracker-backed create/show/list/search helpers.
- `src/tracker/hierarchy.ts` — hierarchy projection/materialization and relationship queries.
- `src/tracker/migrate.ts` — one-time legacy tracker importer that emits canonical `.task` events.
- `src/commands.test.ts` — issue storage and command behavior tests.
- `src/task.test.ts` — flag parsing, help text, and subprocess CLI tests.

## Runtime flow

1. `src/bin/task` invokes `bun src/task.ts`.
2. `src/task.ts` parses argv into a flag map.
3. It resolves either a one-word command (`list`) or two-word command (`meta set`).
4. It normalizes positional issue IDs into `--id` for commands that support them.
5. The command implementation in `src/commands.ts` resolves the repo-local tracker from the working directory and returns plain JSON-compatible data.
6. Core issue creation and reads go through tracker helpers backed by Esther event files under `.task/`.
7. `src/task.ts` serializes the result to JSON, or JSONL for array results when `--jsonl` is set.
8. Errors are emitted as JSON on stderr and the process exits with status 1.

One-time migration flow:
- `task legacy import --source <path>` reads the old mutable tracker layout,
  infers parentage from exactly one local ref, emits canonical issue/store events
  into the current repo’s `.task/`, and then relies on the normal projectors and
  read paths for all later reads.

## Storage model

Tracker data lives under the current repo:

- `.task/events/` — canonical Esther event files
- `.task/indexes/` — rebuildable Esther tag indexes plus task-owned current-state indexes
- `.task/checkpoints/` — rebuildable checkpoint state
- `.task/issues/` — current issue projections and visible store materializations

Each issue projection directory is still named `<id>-<slug>`.

Inside an issue projection directory:

- `issue.json` — current metadata projection
- `<store>/...` — optional store directories for larger notes or structured artifacts

For core create/show/list/search flows, canonical Esther event files under `.task/events/` are the source of truth. `.task/issues/` and `.task/indexes/` are rebuildable projections; if they are missing, stale, or corrupt, reads rebuild them from canonical history.

## Issue metadata conventions

Standard fields currently used by the CLI:

- `title`
- `description`
- `status` (`open` / `closed` by convention)
- `phase` (`research` by default; other values are conventions, not schema-enforced)
- `priority` (number, lower is more urgent; default `2`)
- `created`
- `updated`
- `refs` (external references or non-hierarchy links)
- `labels`
- `github_issue` (optional number)

Important: the code does not enforce a full metadata schema. New or modified behavior should preserve these conventions and avoid introducing silent type drift.

## Design constraints

- The CLI is intentionally machine-oriented: output is JSON first, not pretty terminal prose.
- The command layer is thin; most behavior belongs in `src/commands.ts` helpers rather than in `src/task.ts`.
- File-system interactions are the main boundary. Path safety and predictable file layout matter more than API convenience.
- Tracker resolution is repo-local: commands operate on the current repo, not on a shared home-directory store.
- Hierarchy is explicit: parent/child relationships come from canonical issue events and hierarchy projections, not from `refs`.
- Closing an issue appends `IssueClosed` and leaves the issue in place; the project does not have a separate delete command for issues.

## Migration and rollout

Migration is intentionally separate from day-to-day issue commands.

- The source is a legacy tracker root in the old mutable layout.
- The target is the current repo’s `.task/` tracker.
- Import is one-time only: if canonical events or issue projections already
  exist in the target, `task legacy import` refuses with
  `target_already_initialized`.
- Legacy local refs are interpreted only during import:
  - `0` local issue refs → import as a root issue
  - `1` local issue ref → import as a child of that issue and drop that ref from
    the migrated `refs` array
  - `>1` local issue refs → abort with `ambiguous_legacy_parent`
- Imported store files become canonical `StoreRevisionSaved` +
  `StoreRevisionFinalized` revision 1 entries in the issue’s current phase.
- After import, normal CLI reads use only canonical `.task/events/` plus
  rebuildable projections.

Rollout order remains:
1. implement the repo-local tracker
2. implement rebuildable projections/materializers
3. run the legacy import
4. dogfood the new tracker

## When changing behavior

Open this doc first when you need to:

- add a command
- change issue storage layout
- change JSON output contracts
- understand how open vs closed issues are projected from canonical history
- avoid drifting into `packages/esther/` by mistake
- confirm the user explicitly wants Esther work before touching `packages/esther/`

## If you add a command

Update all of these together:

- implementation in `src/commands.ts`
- registration in the exported `commands` map
- help text / examples exposed through the command metadata
- tests in `src/commands.test.ts` and/or `src/task.test.ts`
