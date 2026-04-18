# Commands

Use `bin/task` for normal CLI usage, or run `bun task.ts` directly from the repo root.

Commands resolve tracker data from the current repo. If you run from a subdirectory, `task` walks up to the nearest existing `.task/` or `.git/` directory; otherwise it uses the current working directory.

## Command groups

### Inspect issues

- `task show <id>` — full issue details
- `task show <id> --summary` — metadata only
- `task list` — open issues, compact output by default
- `task search <query>` — text search across id, title, description, refs, and labels
- `task children <id>` / `task parents <id>` / `task related <id>` — hierarchy relationship views

### Create and update issues

- `task create --title <title> [--description ...] [--priority 0-4] [--label ...] [--github-issue ...] [--parent <id>]`
- `task meta set <id> --key <key> --value <value>`
- `task meta get <id> --key <key>`
- `task update label <id> --add <label> [--remove <label>]`
- `task update refs <id> --add <ref> [--remove <ref>]`
- `task close <id>` — move issue to archive and set `status` to `closed`

### Work with stores

- `task store set <id> --store <store> --key <key> [--value <value> | --file <path>]`
- `task store get <id> --store <store> --key <key>`
- `task store keys <id> --store <store>`
- `task store delete <id> --store <store> [--key <key>]`

## CLI grammar rules

- Flags must be space-separated: use `--flag value`, not `--flag=value`.
- Repeated flags are allowed for commands like `--label`, `--where`, `--add`, and `--remove`.
- Many issue commands accept either `task show ab12` or `task show --id ab12`.
- Two-word commands are real command names: `meta set`, `meta get`, `update label`, `update refs`, `store set`, `store get`, `store keys`, `store delete`.

## Output rules

- Normal output is compact JSON with no extra prose.
- `--jsonl` only changes array output; object results stay single JSON objects.
- `list`, `children`, `parents`, and `related` default to compact field projections unless `--full` or `--fields` is used.
- `show` includes store indexes by default, but `--summary`, `--compact`, or `--fields` suppresses that unless `--include-stores` is passed.

## High-value examples

```bash
task create --title "Fix login bug" --priority 0 --label cli --label bug
task create --title "Follow-up parser fix" --parent ab12
task show ab12 --summary
task list --where phase=research --sort updated
task search "packet session"
task update refs ab12 --add m85s
task store set ab12 --store research --key summary --file /tmp/summary.md
task close ab12
```

## Command gotchas

- `task list` ignores archived issues unless you pass `--all`.
- `task close` archives the issue directory; it does not delete history.
- `task meta set` writes raw strings. Do not use it as if it were a typed field updater.
- Prefer `update label` and `update refs` for arrays instead of editing those fields through `meta set`.
- Use `create --parent <id>` for local hierarchy. `children`, `parents`, and `related` read hierarchy state, not `refs`.
- Be careful with `priority`: `create --priority` stores a number, but `meta set --key priority --value 0` stores the string `"0"`, which changes sort behavior.
- Store names and keys are restricted to safe path characters (`A-Z`, `a-z`, `0-9`, `_`, `.`, `-`) and may not contain `..`.

## Where data goes

Commands operate on the current repo’s `.task/` tracker:

- `.task/events/` — canonical Esther event history
- `.task/indexes/` and `.task/checkpoints/` — rebuildable Esther metadata
- `.task/issues/` — current issue projections
- `.task/issues/.archive/` — archived issue projections

Core `create`, `show`, `list`, and `search` flows are backed by canonical Esther event files, with `.task/issues/` acting as the rebuildable current-state projection.
