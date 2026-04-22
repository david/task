name: qa-04-phase-transition-revision-behavior
role: agent
depends_on: []

# QA-04: Phase transition finalization and later-phase resave behavior

## Test Steps
1. Create a fresh fixture issue in `research`.
2. Save a document at `research/plan`.
3. Advance the issue phase.
4. Save the same path again in the new phase.
5. Verify the later-phase save is visible and prior finalized history is preserved rather than mutated in place.

## Expected
Changing phase finalizes the prior draft revision, and a later-phase save to the same path creates a new visible revision without corrupting earlier history.

## Setup Notes
Create a dedicated fixture issue for this test and record its ID plus any history evidence paths in `qa-context`.

## Result
<!-- Filled in after user reports result -->
