name: qa-03-phase-next-and-set-uses-settings
role: agent
depends_on: []

# QA-03: Phase commands honor `.task/settings.json`

## Test Steps

1. In a fresh temp repo, create phase settings and a new issue:
   ```bash
   export TASK_CLI="bun /home/david/task-w0/src/task.ts"
   REPO=$(mktemp -d)
   cd "$REPO"
   git init -q
   mkdir -p .task
   cat > .task/settings.json <<'JSON'
   {
     "defaultPhase": "backlog",
     "phases": ["backlog", "in-progress", "done"],
     "transitions": {
       "backlog": ["in-progress"],
       "in-progress": ["done"],
       "done": []
     }
   }
   JSON
   ISSUE_JSON=$($TASK_CLI create --title "Phase Configured")
   echo "$ISSUE_JSON"
   ```
   Save the issue id.
2. Run:
   ```bash
   $TASK_CLI phase next <ISSUE_ID>
   $TASK_CLI phase set <ISSUE_ID> --value in-progress
   $TASK_CLI show <ISSUE_ID> --summary
   ```
3. Try an invalid transition back to backlog:
   ```bash
   $TASK_CLI phase set <ISSUE_ID> --value backlog
   ```
   Confirm it exits non-zero and prints a JSON error.

## Expected

The created issue starts in `backlog`. `phase next` returns `in-progress`. `phase set` successfully moves the issue to `in-progress`, and `show --summary` reports the updated phase. The invalid transition back to `backlog` fails with a clear JSON error instead of silently changing state.

## Setup Notes

Use a separate temp repo because this test needs custom `.task/settings.json`.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
