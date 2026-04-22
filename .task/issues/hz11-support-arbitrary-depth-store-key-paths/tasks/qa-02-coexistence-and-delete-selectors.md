name: qa-02-coexistence-and-delete-selectors
role: agent
depends_on: [qa-01-save-read-nested-documents]

# QA-02: Coexistence and delete selector behavior

## Test Steps
1. Reuse the fixture issue from QA-01.
2. Save a document at `research` while nested documents already exist under `research/...`.
3. Verify `task get <issue-id> --key research/` shows both `research.value` and nested `entries`.
4. Delete the exact `research` document with `task delete <issue-id> --key research` and verify nested entries remain.
5. Delete the subtree with `task delete <issue-id> --key research/` and verify the subtree is gone.
6. Save a few top-level documents and verify `task delete <issue-id> --key /` clears the full tree.

## Expected
A path can exist as both a document and subtree root, exact delete removes only that document value, subtree delete removes descendants, and root delete clears all attached documents.

## Setup Notes
Reuse the fixture issue ID from `qa-context:qa-01-save-read-nested-documents`.

## Result
<!-- Filled in after user reports result -->
