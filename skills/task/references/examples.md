# Task examples

Use these as known-good command shapes.

## Create and inspect

```bash
task bootstrap
task bootstrap --force
task create --title "Fix login bug" --priority 0 --label cli --label bug
task create --title "Parser follow-up" --parent ab12
task show ab12
task show ab12 --summary
task show ab12 --include-keys
task list --where phase=research --sort updated
task search "packet session"
```

## Hierarchy, labels, refs, and workflow

```bash
task children ab12
task parents cd34
task related ab12
task update label ab12 --add cli --add bug
task update refs ab12 --add GH-123
task phase next ab12
task phase set ab12 --value ready-to-code
```

## Issue documents

```bash
task set ab12 --key research/summary --value "Initial notes"
task set ab12 --key research/plan --file /tmp/plan.md
task get ab12 --key research/summary
task get ab12 --key research/
task get ab12 --key /
task delete ab12 --key research/summary
task delete ab12 --key research/
```

## Metadata and closing

```bash
task meta get ab12 --key owner
task meta set ab12 --key owner --value backend
task close ab12
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
