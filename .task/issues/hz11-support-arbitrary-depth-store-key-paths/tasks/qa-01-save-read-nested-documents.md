name: qa-01-save-read-nested-documents
role: agent
depends_on: []

# QA-01: Save and read nested issue documents

## Test Steps
1. Create a fresh QA fixture issue.
2. Save nested content with `task set <issue-id> --key research/notes/today --value ...`.
3. Read the exact path with `task get <issue-id> --key research/notes/today`.
4. Read the subtree with `task get <issue-id> --key research/`.
5. Read the full tree with `task get <issue-id> --key /`.

## Expected
Exact reads return only the selected path, subtree reads return a recursive `value`/`entries` tree rooted at `research`, and root reads return the full attached-document tree.

## Setup Notes
Create a dedicated QA fixture issue for this run and record its ID in `qa-context` so later tests can reuse it.

## Result
<!-- Filled in after user reports result -->
