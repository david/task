{
  "taskKey": "qa-06-closed-issues-stay-queryable-and-projections-rebuild",
  "recordedAt": "2026-04-19T17:22:23.936432+00:00",
  "role": "agent",
  "browserSession": "shell",
  "url": null,
  "shortSummary": "search --all before positional query rejects the query",
  "expectedBehavior": "The exact QA step `$TASK_CLI search --all \"rebuild child\"` should succeed and return the closed child, as described in the stored QA task.",
  "actualBehavior": "The command exited with code 1 and stderr `{\"error\":\"search query is required (pass positional text or --text)\"}`. Using `search \"rebuild child\" --all` succeeded, which suggests query parsing is order-sensitive.",
  "reproSteps": [
    "Create parent and child in a fresh temp repo.",
    "Close the child issue.",
    "Run `$TASK_CLI search --all \"rebuild child\"`.",
    "Observe exit code 1 and the missing-query JSON error."
  ],
  "failingStep": 2,
  "setupContext": {
    "repo": "/tmp/task-qa-06-lfiy9gvc",
    "parentIssueId": "h1cm-rebuild-parent",
    "childIssueId": "zz3k-rebuild-child"
  },
  "notes": [
    "Other pre-failure checks passed: `show` found the closed child and `list --all` showed it as closed.",
    "Workaround observed: `bun /home/david/task-w0/src/task.ts search \"rebuild child\" --all` succeeds in the same repo."
  ]
}