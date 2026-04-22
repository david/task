fixture_issue_id: umwr-qa-fixture-for-hz11-nested-documents-new
role: agent
cli_entrypoint: bun src/task.ts
subtree_with_value_json: {"entries":{"research":{"value":"overview from qa-02","entries":{"notes":{"entries":{"today":{"value":"hello from qa-01"}}}}}}}
after_exact_delete_json: {"entries":{"research":{"entries":{"notes":{"entries":{"today":{"value":"hello from qa-01"}}}}}}}
after_subtree_delete_json: {"entries":{}}
after_root_delete_json: {"entries":{}}