name: qa-05-later-store-edit-creates-new-revision
role: agent
depends_on: []

# QA-05: Editing a store key in a later phase creates a new revision

## Test Steps

1. In a fresh temp repo, configure `research -> ready-to-code` phases and create an issue:
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
   ISSUE_JSON=$($TASK_CLI create --title "Store Revisions")
   echo "$ISSUE_JSON"
   ```
   Save the issue id.
2. Save an initial store value, change phase, then save the same key again:
   ```bash
   echo 'phase one' | $TASK_CLI store set <ISSUE_ID> --store research --key summary
   $TASK_CLI phase set <ISSUE_ID> --value ready-to-code
   echo 'phase two' | $TASK_CLI store set <ISSUE_ID> --store research --key summary
   ```
3. Confirm the visible value and inspect the event history:
   ```bash
   $TASK_CLI store get <ISSUE_ID> --store research --key summary
   grep -R '"type": "StoreRevisionSaved"' .task/events/by-issue/<ISSUE_ID>
   grep -R '"supersedesRevision": 1' .task/events/by-issue/<ISSUE_ID>
   ```

## Expected

`store get` returns `phase two`. The event history still shows the original revision from `research`, plus a second saved revision in `ready-to-code` that supersedes revision 1. The older finalized revision is preserved instead of being overwritten in place.

## Setup Notes

Use a separate temp repo for this test so the event history only contains one key’s revision chain.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
