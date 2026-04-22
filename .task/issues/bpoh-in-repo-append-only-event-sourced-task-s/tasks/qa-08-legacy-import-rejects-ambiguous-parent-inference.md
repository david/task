name: qa-08-legacy-import-rejects-ambiguous-parent-inference
role: agent
depends_on: []

# QA-08: Legacy import rejects ambiguous parent inference

## Test Steps

1. In a fresh temp repo, prepare an empty import target and a separate legacy source:
   ```bash
   export TASK_CLI="bun /home/david/task-w0/src/task.ts"
   TARGET_REPO=$(mktemp -d)
   LEGACY_ROOT=$(mktemp -d)
   cd "$TARGET_REPO"
   git init -q
   mkdir -p "$LEGACY_ROOT"/aaaa-first-parent
   mkdir -p "$LEGACY_ROOT"/bbbb-second-parent
   mkdir -p "$LEGACY_ROOT"/cccc-child
   ```
2. Create three legacy `issue.json` files:
   - `aaaa-first-parent`: open issue, no refs
   - `bbbb-second-parent`: open issue, no refs
   - `cccc-child`: open issue whose `refs` contains both `aaaa-first-parent` and `bbbb-second-parent`
3. Run the import and confirm it fails:
   ```bash
   $TASK_CLI legacy import --source "$LEGACY_ROOT"
   ```
4. Verify no partial state was imported:
   ```bash
   $TASK_CLI list --all
   find .task -maxdepth 3 -type f | sort
   ```

## Expected

The import exits non-zero with a JSON error containing `ambiguous_legacy_parent`. The target repo does not end up with partially imported issues: `list --all` stays empty, and there is no successful `.task/events/by-issue/<issue>` import result.

## Setup Notes

Use a brand-new target repo for this test. Keep the fixture minimal so the failure is easy to inspect.

## Result

<!-- Filled in by /skill:qa coordinator after user reports result -->
