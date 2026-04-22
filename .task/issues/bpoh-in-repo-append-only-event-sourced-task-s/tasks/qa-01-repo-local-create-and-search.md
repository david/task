name: qa-01-repo-local-create-and-search
role: agent
depends_on: []

# QA-01: Repo-local create/list/show/search flow

## Test Steps

1. In a shell, run:
   ```bash
   export TASK_CLI="bun /home/david/task-w0/src/task.ts"
   REPO=$(mktemp -d)
   cd "$REPO"
   git init -q
   ISSUE_JSON=$($TASK_CLI create --title "Repo Local Root" --description "repo-local check" --priority 0 --label cli --label migration)
   echo "$ISSUE_JSON"
   ```
   Save the created issue id from the JSON output.
2. Run `show`, `list`, and `search` for that issue:
   ```bash
   $TASK_CLI show <ISSUE_ID>
   $TASK_CLI list
   $TASK_CLI search "repo local"
   ```
3. Inspect the repo-local tracker files:
   ```bash
   find .task -maxdepth 3 -type f | sort
   cat .task/issues/<ISSUE_ID>/issue.json
   ```
4. Confirm the canonical event history exists under `.task/events/by-issue/<ISSUE_ID>`.

## Expected

The issue is created under the temp repo’s `.task/` directory, not in any shared/global location. `show`, `list`, and `search` all return the same issue. The metadata shows `status: open`, `phase: research`, `priority: 0`, and both labels. `.task/issues/<ISSUE_ID>/issue.json` matches the current state, and `.task/events/by-issue/<ISSUE_ID>` contains immutable event JSON files.

## Setup Notes

Use a brand-new temp repo for this test. No other setup is required.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
