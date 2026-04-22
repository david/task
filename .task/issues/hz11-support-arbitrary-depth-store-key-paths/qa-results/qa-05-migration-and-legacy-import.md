task_key: qa-05-migration-and-legacy-import
recorded_at: 2026-04-21T21:36:02Z
role: agent
browser_session: n/a
url: n/a
summary: Legacy import passed using a fresh test-compatible legacy tracker fixture; imported store content is readable through path-based document keys and materialized as .md files in .task/issues.
status: pass
fixture_root: /tmp/tmp.X9rGKXEbUU
legacy_source_root: /tmp/tmp.X9rGKXEbUU/legacy-import-source
target_root: /tmp/tmp.X9rGKXEbUU/legacy-import-target
checks:
  import_output: |
    {"imported":true,"source":"/tmp/tmp.X9rGKXEbUU/legacy-import-source","issueCount":3,"storeCount":4}
  child_research_get: |
    {"entries":{"research":{"entries":{"summary":{"value":"child summary"}}}}}
  child_tasks_get: |
    {"entries":{"tasks":{"entries":{"plan":{"value":"child plan"}}}}}
  parent_children: |
    [{"id":"bbbb-child-task","title":"Child Task","status":"open"}]
  child_parents: |
    [{"id":"aaaa-parent-epic","title":"Parent Epic","status":"open"}]
  list_all: |
    [{"id":"bbbb-child-task","title":"Child Task","status":"open"},{"id":"aaaa-parent-epic","title":"Parent Epic","status":"open"},{"id":"cccc-closed-task","title":"Closed Task","status":"closed"}]
  materialized_files: |
    /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/aaaa-parent-epic/issue.json
    /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/aaaa-parent-epic/research/summary.md
    /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/bbbb-child-task/issue.json
    /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/bbbb-child-task/research/summary.md
    /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/bbbb-child-task/tasks/plan.md
    /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/cccc-closed-task/issue.json
    /tmp/tmp.X9rGKXEbUU/legacy-import-target/.task/issues/cccc-closed-task/notes/summary.md
  materialized_content:
    child_summary: child summary
    child_plan: child plan
    closed_summary: closed summary
