# Task examples

Use these as known-good command shapes.

## Create and inspect

```bash
bin/task create --title "Fix login bug" --priority 0 --label cli --label bug
bin/task create --title "Parser follow-up" --parent ab12
bin/task show ab12
bin/task show ab12 --summary
bin/task show ab12 --include-keys
bin/task list --where phase=research --sort updated
bin/task search "packet session"
```

## Hierarchy, labels, refs, and workflow

```bash
bin/task children ab12
bin/task parents cd34
bin/task related ab12
bin/task update label ab12 --add cli --add bug
bin/task update refs ab12 --add GH-123
bin/task phase next ab12
bin/task phase set ab12 --value ready-to-code
```

## Issue documents

```bash
bin/task set ab12 --key research/summary --value "Initial notes"
bin/task set ab12 --key research/plan --file /tmp/plan.md
bin/task get ab12 --key research/summary
bin/task get ab12 --key research/
bin/task get ab12 --key /
bin/task delete ab12 --key research/summary
bin/task delete ab12 --key research/
```

## Metadata and closing

```bash
bin/task meta get ab12 --key owner
bin/task meta set ab12 --key owner --value backend
bin/task close ab12
```

## Wrong patterns to avoid

Do not do these:

```bash
task create --title="Bad flag syntax"
task meta set ab12 --key phase --value ready-to-code
task update refs ab12 --add parent-issue-id
task set ab12 --key research/ --value "subtree writes are invalid"
```

Use these instead:

```bash
task create --title "Good flag syntax"
task phase set ab12 --value ready-to-code
task create --title "Child issue" --parent ab12
task set ab12 --key research/summary --value "exact document path"
```
