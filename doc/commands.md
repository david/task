# Commands

Use `bun task.ts` directly from the repo root.

Commands resolve tracker data from the current repo. If you run from a subdirectory, `task` walks up to the nearest existing `.task/` or `.git/` directory; otherwise it uses the current working directory.

## Command groups

### Inspect issues

- `task show <id>` — full issue details
- `task show <id> --summary` — metadata only
- `task show <id> --include-keys` — metadata plus current logical document keys
- `task list` — open issues, compact output by default
- `task search <query>` — text search across id, title, description, refs, and labels
- `task children <id>` / `task parents <id>` / `task related <id>` — hierarchy relationship views

### Bootstrap workflow docs

- `task bootstrap [--root <path>] [--force]` — scaffold `doc/task-workflow.md` for the task-backed workflow and point to optional project-native docs such as `doc/coding.md` or `doc/committing.md`

### Create and update issues

- `task create --title <title> [--description ...] [--priority 0-4] [--label ...] [--github-issue ...] [--parent <id>]`
- `task phase next <id>`
- `task phase set <id> --value <phase>`
- `task meta set <id> --key <key> --value <value>` — non-reserved metadata only
- `task meta get <id> --key <key>`
- `task update label <id> --add <label> [--remove <label>]`
- `task update refs <id> --add <ref> [--remove <ref>]`
- `task close <id>` — append `IssueClosed` and set `status` to `closed` without moving the issue directory

### Work with issue documents

- `task set <id> --key <path> [--value <value> | --file <path>]`
- `task get <id> --key <path|path/|/>`
- `task delete <id> --key <path|path/|/>`

Document selectors use these rules:

- exact document path: `research/summary`
- subtree selector: `research/`
- full-tree selector: `/`

`task set` is append-only in canonical history. The visible document view always returns the latest current content for each logical path, while earlier finalized revisions remain in `.task/events/`.

### One-time migration

- `task legacy import --source <path>` — import a legacy tracker root into the current repo’s `.task/` event store

## CLI grammar rules

- Flags must be space-separated: use `--flag value`, not `--flag=value`.
- Repeated flags are allowed for commands like `--label`, `--where`, `--add`, and `--remove`.
- Many issue commands accept either `task show ab12` or `task show --id ab12`.
- Two-word commands are real command names: `legacy import`, `phase next`, `phase set`, `meta set`, `meta get`, `update label`, and `update refs`.

## Output rules

- Normal output is compact JSON with no extra prose.
- `--jsonl` only changes array output; object results stay single JSON objects.
- `list`, `children`, `parents`, and `related` default to compact field projections unless `--full` or `--fields` is used.
- `show` includes current logical document keys by default, but `--summary`, `--compact`, or `--fields` suppresses that unless `--include-keys` is passed.

## High-value examples

```bash
task bootstrap
task bootstrap --force
task create --title "Fix login bug" --priority 0 --label cli --label bug
task create --title "Follow-up parser fix" --parent ab12
task legacy import --source /tmp/old-issues
task show ab12 --summary
task show ab12 --include-keys
task phase next ab12
task phase set ab12 --value ready-to-code
task list --where phase=research --sort updated
task search "packet session"
task update refs ab12 --add m85s
task set ab12 --key research/summary --file /tmp/summary.md
task get ab12 --key research/
task delete ab12 --key research/
task close ab12
```

## Command gotchas

- `task bootstrap` writes `doc/task-workflow.md`, not tracker issue data. Use `--force` only when you intentionally want to overwrite that scaffolded workflow doc.
- `task list` and `task search` ignore closed issues unless you pass `--all`.
- `task close` appends history and keeps the issue under `.task/issues/`; it does not move or delete canonical data.
- `task phase set` validates transitions against `.task/settings.json` and finalizes any open draft document revisions for that issue.
- `task phase next` returns the single configured next phase for the issue’s current phase.
- `task meta set` writes raw strings and rejects reserved keys like `status`, `phase`, and `parentId`.
- Prefer `update label` and `update refs` for arrays instead of editing those fields through `meta set`.
- Use `create --parent <id>` for local hierarchy. `children`, `parents`, and `related` read hierarchy state, not `refs`.
- `task legacy import` is a one-time migration path, not a daily workflow command.
- `task legacy import` refuses when the target repo already has canonical tracker data (`target_already_initialized`).
- During `task legacy import`, exactly one local legacy ref becomes the parent link; more than one aborts with `ambiguous_legacy_parent`; external refs remain refs.
- Imported legacy document files are materialized as finalized revision 1 in the issue’s current phase.
- During `task legacy import`, legacy document filenames ending in `.md` are normalized to document keys without that suffix before materialization, so a legacy file like `research/summary.md` becomes the logical key `research/summary`.
- `task set` only accepts exact document paths such as `research/summary`. Trailing-slash subtree selectors such as `research/` and the root selector `/` are valid for `get` and `delete`, but are rejected for `set`.
- Later `task set` calls for the same document path create new revisions after a phase change instead of mutating finalized history.
- Document path segments are restricted to safe characters (`A-Z`, `a-z`, `0-9`, `_`, `-`). Use `/` between segments; empty segments and `..` are invalid.

## Where data goes

Commands operate on the current repo’s `.task/` tracker:

- `.task/events/` — canonical Esther event history
- `.task/indexes/` and `.task/checkpoints/` — rebuildable Esther metadata and task-owned indexes
- `.task/issues/` — current issue projections and visible document materializations

Core `create`, `show`, `list`, and `search` flows are backed by canonical Esther event files, with `.task/issues/` and `.task/indexes/` acting as rebuildable current-state projections.
