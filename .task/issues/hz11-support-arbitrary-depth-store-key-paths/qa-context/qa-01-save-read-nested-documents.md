fixture_issue_id: umwr-qa-fixture-for-hz11-nested-documents-new
role: agent
cli_entrypoint: bun src/task.ts
exact_read_json: {"entries":{"research":{"entries":{"notes":{"entries":{"today":{"value":"hello from qa-01"}}}}}}}
subtree_read_json: {"entries":{"research":{"entries":{"notes":{"entries":{"today":{"value":"hello from qa-01"}}}}}}}
root_read_json: {"entries":{"research":{"entries":{"notes":{"entries":{"today":{"value":"hello from qa-01"}}}}}}}
note: legacy bun task.ts uses a different/old CLI surface and tracker state.