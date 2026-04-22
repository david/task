name: qa-07-legacy-import-migrates-current-state
role: agent
depends_on: []

# QA-07: Legacy import migrates current state into the repo-local event store

## Test Steps

1. In a fresh temp repo, prepare a separate legacy tracker source directory:
   ```bash
   export TASK_CLI="bun /home/david/task-w0/src/task.ts"
   TARGET_REPO=$(mktemp -d)
   LEGACY_ROOT=$(mktemp -d)
   cd "$TARGET_REPO"
   git init -q
   mkdir -p "$LEGACY_ROOT"/aaaa-parent-epic/research
   mkdir -p "$LEGACY_ROOT"/bbbb-child-task/research
   mkdir -p "$LEGACY_ROOT"/bbbb-child-task/tasks
   mkdir -p "$LEGACY_ROOT"/.archive/cccc-closed-task/notes
   ```
2. Write three legacy issues:
   - `aaaa-parent-epic/issue.json`: open parent with `refs: ["external-parent-ref"]`, label `epic`, and `github_issue: 101`
   - `bbbb-child-task/issue.json`: open child with `refs: ["aaaa-parent-epic", "external-child-ref"]`, label `backend`, phase `ready-to-code`, and extra metadata like `owner: "backend"`
   - `.archive/cccc-closed-task/issue.json`: closed archived issue with label `done`
   Also write store files:
   - `aaaa-parent-epic/research/summary`
   - `bbbb-child-task/research/summary`
   - `bbbb-child-task/tasks/plan`
   - `.archive/cccc-closed-task/notes/summary`
3. Run the import:
   ```bash
   $TASK_CLI legacy import --source "$LEGACY_ROOT"
   ```
4. Verify the migrated state with normal commands:
   ```bash
   $TASK_CLI list --fields id,title,status
   $TASK_CLI list --all --fields id,title,status
   $TASK_CLI show bbbb-child-task --summary
   $TASK_CLI children aaaa-parent-epic --fields id,title,status
   $TASK_CLI parents bbbb-child-task --fields id,title,status
   $TASK_CLI store get bbbb-child-task --store research --key summary
   $TASK_CLI store get bbbb-child-task --store tasks --key plan
   $TASK_CLI search --all "external-child-ref"
   find .task/events/by-issue -maxdepth 1 -mindepth 1 -type d | sort
   ```

## Expected

The import succeeds and normal CLI reads show the same current state as the legacy source. The child appears under the parent because its single local ref became hierarchy, while the external ref stays searchable. The closed issue is visible via `list --all` and `show`. Imported store content is readable, and `.task/events/by-issue/` contains event directories for all imported issues.

## Setup Notes

Use a brand-new target repo with no existing `.task` data. Any valid legacy fixture matching the metadata above is fine.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
