name: qa-06-closed-issues-stay-queryable-and-projections-rebuild
role: agent
depends_on: []

# QA-06: Closed issues stay queryable and projections rebuild from canonical history

## Test Steps

1. In a fresh temp repo, create a parent and child, add store content to the child, then close it:
   ```bash
   export TASK_CLI="bun /home/david/task-w0/src/task.ts"
   REPO=$(mktemp -d)
   cd "$REPO"
   git init -q
   PARENT_JSON=$($TASK_CLI create --title "Rebuild Parent")
   echo "$PARENT_JSON"
   CHILD_JSON=$($TASK_CLI create --title "Rebuild Child" --parent <PARENT_ID>)
   echo "$CHILD_JSON"
   echo 'canonical summary' | $TASK_CLI store set <CHILD_ID> --store research --key summary
   $TASK_CLI close <CHILD_ID>
   ```
2. Before corrupting anything, verify the closed child is still visible:
   ```bash
   $TASK_CLI show <CHILD_ID>
   $TASK_CLI list --all --fields id,title,status
   $TASK_CLI search --all "rebuild child"
   $TASK_CLI children <PARENT_ID>
   $TASK_CLI children <PARENT_ID> --all --fields id,title,status
   ```
3. Corrupt/remove rebuildable artifacts while leaving canonical events alone:
   ```bash
   rm -rf .task/indexes/hierarchy .task/indexes/issues
   rm -rf .task/issues/<CHILD_ID>/research
   rm -f .task/issues/<PARENT_ID>/issue.json
   cat > .task/issues/<CHILD_ID>/issue.json <<'JSON'
   {
     "title": "Wrong Title",
     "description": "wrong description",
     "status": "open",
     "phase": "research",
     "priority": 9,
     "created": "",
     "updated": "",
     "refs": [],
     "labels": []
   }
   JSON
   ```
4. Re-run normal reads and inspect rebuilt files:
   ```bash
   $TASK_CLI show <CHILD_ID>
   $TASK_CLI list --all --fields id,title,status
   $TASK_CLI children <PARENT_ID> --all --fields id,title,status
   $TASK_CLI store get <CHILD_ID> --store research --key summary
   find .task/indexes -type f | sort
   cat .task/issues/<CHILD_ID>/issue.json
   ```
5. Confirm the issue still lives under `.task/issues/<CHILD_ID>` and not under `.task/issues/.archive/<CHILD_ID>`.

## Expected

Closing the child does not remove it from normal lookup: `show`, `list --all`, and `search --all` still find it, default `children` hides it, and `children --all` shows it as closed. After deleting or corrupting projections, the read commands rebuild correct state from `.task/events/`: the child title/status are restored, the store value comes back, hierarchy indexes are recreated, and the closed issue remains under `.task/issues/` rather than moving to `.archive`.

## Setup Notes

Use a separate temp repo for this test. This is the main regression check for canonical-history rebuild behavior.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
