name: qa-03-invalid-paths-and-help-surface
role: agent
depends_on: []

# QA-03: Invalid paths and user-facing command surface

## Test Steps
1. Run invalid-path cases such as `/research`, `research//today`, and `research/../today` against `task set`.
2. Verify they fail clearly.
3. Inspect the user-facing help or command docs for `task set`, `task get`, and `task delete`.
4. Confirm the user-facing surface no longer tells users to use `task store ...` for attached documents.

## Expected
Invalid key paths are rejected with clear errors, and the user-facing help/examples consistently describe the new `set/get/delete --key` model instead of `store/key` attachment commands.

## Setup Notes
Reuse the fixture issue from QA-01 if available; otherwise create a fresh disposable issue.

## Result
<!-- Filled in after user reports result -->
