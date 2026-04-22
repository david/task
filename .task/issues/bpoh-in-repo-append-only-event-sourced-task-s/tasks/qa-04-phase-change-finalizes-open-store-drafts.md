name: qa-04-phase-change-finalizes-open-store-drafts
role: agent
depends_on: []

# QA-04: Phase change finalizes open store drafts

## Test Steps

1. In a fresh temp repo, create settings with one allowed transition:
   ```bash
   export TASK_CLI="bun /home/david/task-w0/src/task.ts"
   REPO=$(mktemp -d)
   cd "$REPO"
   git init -q
   mkdir -p .task
   cat > .task/settings.json <<'JSON'
   {
     "defaultPhase": "research",
     "phases": ["research", "ready-to-code"],
     "transitions": {
       "research": ["ready-to-code"],
       "ready-to-code": []
     }
   }
   JSON
   ISSUE_JSON=$($TASK_CLI create --title "Finalize Drafts")
   echo "$ISSUE_JSON"
   ```
   Save the issue id.
2. Save two store entries in the starting phase:
   ```bash
   echo 'draft summary' | $TASK_CLI store set <ISSUE_ID> --store research --key summary
   echo 'draft plan' | $TASK_CLI store set <ISSUE_ID> --store tasks --key plan
   ```
3. Advance the phase:
   ```bash
   $TASK_CLI phase set <ISSUE_ID> --value ready-to-code
   ```
4. Confirm the visible store content still reads correctly:
   ```bash
   $TASK_CLI store get <ISSUE_ID> --store research --key summary
   $TASK_CLI store get <ISSUE_ID> --store tasks --key plan
   ```
5. Inspect the canonical event files for finalization events:
   ```bash
   grep -R '"type": "StoreRevisionFinalized"' .task/events/by-issue/<ISSUE_ID>
   ```

## Expected

The phase change succeeds, both store values remain visible, and the canonical event history now contains one `StoreRevisionFinalized` event for each previously open draft key.

## Setup Notes

Use a separate temp repo for this test. The tester only needs shell access.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
