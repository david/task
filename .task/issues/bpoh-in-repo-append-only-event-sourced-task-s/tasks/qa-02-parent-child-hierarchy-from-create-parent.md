name: qa-02-parent-child-hierarchy-from-create-parent
role: agent
depends_on: []

# QA-02: Parent/child hierarchy from `create --parent`

## Test Steps

1. In a fresh temp repo, run:
   ```bash
   export TASK_CLI="bun /home/david/task-w0/src/task.ts"
   REPO=$(mktemp -d)
   cd "$REPO"
   git init -q
   PARENT_JSON=$($TASK_CLI create --title "Parent Epic")
   echo "$PARENT_JSON"
   ```
   Save the parent issue id.
2. Create a child that points at the parent:
   ```bash
   CHILD_JSON=$($TASK_CLI create --title "Child Task" --parent <PARENT_ID>)
   echo "$CHILD_JSON"
   ```
   Save the child issue id.
3. Verify the child metadata and relationship commands:
   ```bash
   $TASK_CLI show <CHILD_ID> --summary
   $TASK_CLI children <PARENT_ID>
   $TASK_CLI parents <CHILD_ID>
   $TASK_CLI related <PARENT_ID>
   ```
4. Check that the child did not gain a local ref just because it has a parent.

## Expected

`children` returns the child under the parent, `parents` returns the parent for the child, and `related` shows the relationship. The child metadata still has `refs: []`, proving the hierarchy comes from event-backed parent linkage rather than refs mutation.

## Setup Notes

Use a separate temp repo for this test so the relationship output is easy to inspect.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
