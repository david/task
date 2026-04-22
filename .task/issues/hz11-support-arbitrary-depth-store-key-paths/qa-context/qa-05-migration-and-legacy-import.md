fixture_root: /tmp/tmp.X9rGKXEbUU
legacy_source_root: /tmp/tmp.X9rGKXEbUU/legacy-import-source
target_root: /tmp/tmp.X9rGKXEbUU/legacy-import-target
entrypoint_under_test: bun task.ts
imported_issue_ids:
  - aaaa-parent-epic
  - bbbb-child-task
  - cccc-closed-task
materialized_paths:
  - /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/aaaa-parent-epic/research/summary.md
  - /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/bbbb-child-task/research/summary.md
  - /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/bbbb-child-task/tasks/plan.md
  - /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/cccc-closed-task/notes/summary.md
