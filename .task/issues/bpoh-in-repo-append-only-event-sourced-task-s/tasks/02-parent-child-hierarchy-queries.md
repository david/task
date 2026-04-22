---
name: 02-parent-child-hierarchy-queries
role: backend
depends_on: [01-esther-repo-local-core]
---

# 02: Parent-child hierarchy projections and relationship commands

## Goal

Implement first-class issue hierarchy so `task create --parent <id>`, `task children`, `task parents`, and `task related` operate from hierarchy events/projections instead of legacy `refs`-driven parent detection.

## Context

The PRD makes parent/child structure explicit:

- `IssueCreated` carries `parentId` in the payload when applicable
- child issue events also carry `parent:<parentId>` tags
- hierarchy views are projections/materializations over canonical event history
- `refs` remain for external or cross-tree references and must not keep driving parent/child commands

This task should extend the event model and read side introduced in task 01 so hierarchy is queryable without mutating `refs`. Preserve the existing JSON-friendly relationship outputs (`relation: parent|child|both` for `related`) unless the approved spec requires otherwise.

## Files

- `commands.ts` — modify: add `--parent` support to `create`; route `children`, `parents`, and `related` through hierarchy helpers instead of ref scanning.
- `commands.test.ts` — modify: replace the current refs-based relationship tests with parent-aware create scenarios and add coverage that external refs are still refs, not hierarchy.
- `task.ts` — modify: refresh help/examples for `create --parent` and any updated relationship wording.
- `tracker/events.ts` — modify: extend `IssueCreated` payload/tag handling with parent metadata.
- `tracker/hierarchy.ts` — create: maintain/query the hierarchy projection or materialized index from issue events.
- `tracker/issues.ts` — modify: validate `--parent`, reject missing/closed/invalid parents per the PRD, and append the right parent tags.
- `doc/commands.md` — modify: document `task create --parent <id>` and clarify that relationship commands are hierarchy-based.
- `doc/project-management.md` — modify: clarify that `refs` are no longer used as parent links in the new tracker.

## TDD Sequence

1. Write a failing scenario test that creates a parent, then a child with `--parent <id>`, and proves `children`, `parents`, and `related` all surface the relationship without `update refs`.
2. Write failing error-path tests for invalid parent references and closed-parent rejection.
3. Implement parent-aware `IssueCreated` append logic and hierarchy projection/materialization.
4. Switch relationship commands from legacy ref scanning to hierarchy reads.
5. Re-run the new relationship scenarios plus the existing search/list/show coverage from task 01.
6. Run quality gates: `bun test` and `bun run typecheck`.

## Verification Tests (from test plan)

### Parent-child hierarchy flows from `create --parent` to relationship commands
- **Setup**: Create a parent issue, then create a child issue with `--parent <id>` and no manual refs.
- **Action**: Run `task children <parent>`, `task parents <child>`, and `task related <parent>`.
- **Assert**: The child appears under the parent, the parent appears for the child, and the relationship is visible without relying on `refs` mutation.
- **Bug caught**: parentage captured in events but not surfaced in projections, or relationship commands still reading legacy refs logic.

## Out of Scope

- `.task/settings.json` or `task phase ...`
- versioned store revisions
- close/read-model rebuild behavior
- migration/import
- changing non-hierarchy `refs` behavior beyond removing parent inference from relationship commands

## Done When

- [ ] `task create --parent <id>` exists and validates parent constraints
- [ ] `children`, `parents`, and `related` read hierarchy state from events/projections
- [ ] Relationship tests no longer depend on `refs` mutation to simulate parentage
- [ ] Docs updated to separate hierarchy from refs
- [ ] Quality gates pass (`bun test`, `bun run typecheck`)
