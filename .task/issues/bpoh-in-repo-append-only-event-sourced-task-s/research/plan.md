---
kind: debug
approved_from: research:diagnosis-retry-2
status: approved
---

# Approved Plan

## Scope
Preserve and verify the shared CLI parser fix so presence-only switches no longer consume following positional input. This bugfix covers the shared parser contract, not a search-only workaround.

## Root Cause
The shared argv parser used to treat every `--flag` as if it might take a value, so `search --all "rebuild child"` lost its positional query before `issueSearch()` ran.

## Proposed Fix
- Keep explicit `switch` vs `value` flag metadata in command definitions.
- Parse argv using that metadata so only value-taking flags consume the next token.
- Preserve positional input after switch flags for both query-style commands and positional-id commands.
- Keep parser-level regression tests for `search --all "rebuild child"` and `show --summary <id>`.

## Source Artifacts
- primary: `research:diagnosis-retry-2`
- supporting: `research:diagnosis`
- supporting: `qa-results:qa-06-closed-issues-stay-queryable-and-projections-rebuild`

## Verification Contract

### Setup / Preconditions
Use a temp git repo with a closed issue whose title matches the search query, or reuse `/tmp/task-qa-06-lfiy9gvc` from the QA artifact.

### User-Observable Proof
- `task search --all "rebuild child"` returns the closed issue.
- `task show --summary <id>` succeeds with the switch before the positional id.
- `children --all <parent-id>` preserves the parent id when a leading switch is present.

### Automated Proof
- Parser regression test for `search --all "rebuild child"`.
- Parser regression test for `show --summary <id>`.
- Relevant helper tests continue to pass, but parser-level coverage is mandatory because helper-only tests do not exercise argv parsing.

### Fast Recheck
```bash
bun test src/task.test.ts
cd /tmp/task-qa-06-lfiy9gvc && bun /home/david/task-w0/src/task.ts search --all "rebuild child"
```

## Out of Scope
- search-index or projection rebuild changes
- command-specific workarounds that leave the shared parser contract wrong
- broader CLI UX redesign
