name: qa-05-migration-and-legacy-import
role: agent
depends_on: []

# QA-05: Migration and legacy import behavior

## Test Steps
1. Use the existing automated fixture or test-compatible sample data for legacy `(store, key)` content.
2. Run the supported migration or import flow.
3. Verify migrated content is accessible via path keys like `<store>/<key>`.
4. Confirm materialized files follow the new `.md` layout where applicable.

## Expected
Legacy attached content migrates or imports into the new path-based document model without losing visibility or breaking reads.

## Setup Notes
Use an existing migration-safe fixture from the repo's QA/test infrastructure. Record the migrated fixture location or issue ID in `qa-context`.

## Result
<!-- Filled in after user reports result -->
