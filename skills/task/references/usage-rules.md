# Task usage rules

Use this decision table when choosing a `task` command.

## Start with inspection

Before mutating, inspect the current state when the target issue or field is not already clear.

```bash
task list
task show <id> --summary
task show <id> --include-keys
```

## Decision table

| Intent | Preferred command | Notes |
|---|---|---|
| Scaffold task-backed workflow docs | `task bootstrap` | Writes `doc/task-workflow.md` and points to optional project-native docs such as `doc/coding.md` or `doc/committing.md`. Use `--force` only when you intend to overwrite the scaffolded workflow doc. |
| Create a new issue | `task create` | Set `--priority`, `--label`, `--github-issue`, and `--parent` at creation time when known. |
| Read one issue | `task show` | Use `--summary` for metadata only, `--include-keys` to list current document keys. |
| Find issues | `task list`, `task search` | `list` is for structured filters; `search` is for free text. Closed issues are hidden unless `--all` is passed. |
| Create local hierarchy | `task create --parent <id>` | Do not encode local parent/child links through `refs`. |
| Read hierarchy | `task children`, `task parents`, `task related` | These read hierarchy state, not `refs`. |
| Advance workflow | `task phase next`, `task phase set` | Never use `meta set` for `phase`. |
| Change labels | `task update label` | Prefer this over editing `labels` through metadata. |
| Change refs | `task update refs` | Use for external or non-hierarchy links only. |
| Write large notes, plans, logs, artifacts | `task set` | Use an exact logical document path such as `research/summary`. |
| Read one document, a subtree, or the full tree | `task get` | Exact path: `research/summary`; subtree: `research/`; full tree: `/`. |
| Delete one document, a subtree, or the full tree | `task delete` | Same selector rules as `task get`. |
| Change a non-reserved simple metadata field | `task meta set` | Safe for simple strings. Be cautious with typed fields. |
| Close completed work | `task close` | Do not manually move or archive issue directories. |
| Import a legacy tracker snapshot | `task legacy import` | One-time migration path, not normal daily workflow. |

## Metadata vs documents

Prefer metadata for compact fields that belong in the issue summary:
- `title`
- `description`
- `phase`
- `priority`
- `labels`
- `refs`
- `github_issue`

Prefer issue documents for larger or structured content:
- research notes
- plans
- repro steps
- QA logs
- generated artifacts

## Command grammar

- Use space-separated flags: `--flag value`
- Repeated flags are valid for `--label`, `--where`, `--add`, and `--remove`
- Many issue commands accept either a positional ID or `--id <id>`
- Two-word commands are real command names: `phase next`, `phase set`, `meta set`, `meta get`, `update label`, `update refs`, `legacy import`

## Path and content rules

Document paths:
- use slash-delimited logical keys like `research/summary`
- may contain letters, numbers, `_`, and `-` in each segment
- must not contain empty segments or `..`
- must not start or end with `/` for `task set`

Selectors:
- exact path: `research/summary`
- subtree: `research/`
- full tree: `/`

Important:
- `task set` only accepts exact paths
- subtree and root selectors are valid for `task get` and `task delete` only

## High-signal gotchas

- `task bootstrap` writes repo docs, not tracker issue data.
- `task meta set` writes raw strings; later changing `priority` this way can convert it from number to string.
- `task list` and `task search` ignore closed issues unless `--all` is passed.
- `task phase set` validates transitions and may finalize open draft document revisions depending on repo rules.
- `task close` appends canonical history and keeps data under `.task/`; do not try to remove issue data manually.
- If behavior is unclear, read the repo's task docs when present instead of guessing.
