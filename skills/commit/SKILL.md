---
name: commit
description: >
  Create git commits following the Conventional Commits specification (conventionalcommits.org).
  Use this skill whenever the user asks to commit, make a commit, save changes, or anything
  related to creating a git commit. Also triggers on /skill:commit.
---

# Commit

Create git commits following [Conventional Commits v1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

If `doc/task-workflow.md` exists, read it before acting.
If `doc/committing.md` exists, read it before acting.

Treat repo docs as project-specific extensions of this skill.

If the commit succeeds, report the commit hash and message to the user. If it fails, report the error.

When multiple commits are created in one `/skill:commit` run, report all of
them in creation order. Include each commit's short hash, subject line, and a
brief note about the logical slice it captured. Also report the final `git
status --short` result so callers can confirm the tree is clean. If `git status
--short` is empty, report the status as the literal word `clean` rather than an
empty block or any unrelated path/text from prompt attachments.

When `/skill:commit` is invoked from `/skill:code`, it must support
multi-commit runs: create as many logical commits as needed for the current
verified work and leave the git tree clean before handing control back.

## Commit message format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

| Type | When to use |
|------|------------|
| `feat` | A new feature or capability |
| `fix` | A bug fix |
| `docs` | Documentation-only changes |
| `style` | Formatting, whitespace, semicolons — no logic change |
| `refactor` | Code restructuring that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `build` | Build system or dependency changes |
| `ci` | CI configuration changes |
| `chore` | Maintenance tasks that don't fit other types |

## Task-backed repo rule

When the repo uses the task-backed workflow, treat `.task/` as first-class
project data.

That means:
- inspect `.task/` changes during commit planning
- include related `.task` artifacts in the same logical commit as the code/docs
  they describe
- exclude only clearly unrelated tracker churn
- if you cannot tell whether a `.task` change is related, stop and ask instead
  of silently dropping it

Do not treat `.task/` as incidental local state in task-backed repos.

## Rules

1. **Type is required.** Always start with one of the types above.
2. **Scope is optional** but encouraged when the change is clearly scoped to a module, component, or area. Use lowercase in parentheses: `feat(auth): ...`
3. **Description** — short imperative summary. Lowercase, no period.
4. **Body** is optional. Explain **why** if not obvious from the diff.
5. **Breaking changes** — add `!` after the type/scope AND include a `BREAKING CHANGE:` footer.
6. **Footers** follow git trailer format: `Token: value` or `Token #value`.
7. **Logical boundaries first.** Prefer several small coherent commits over one mixed commit when the work contains separable verified slices.
8. **Clean-exit support for `/skill:code`.** When another skill requires a clean tree, do not stop after the first commit if staged or unstaged verified work still remains. Finish grouping the remaining verified work into commit(s) until `git status --short` is empty.

## Skipping CI

Add `[skip ci]` when changes cannot affect build, test, or runtime behavior.

**Good candidates:** `docs`, `style`, `chore` (non-dependency).

**Never skip CI for:** `feat`, `fix`, `refactor`, `perf`, `test`, `build`, `ci`, or any `chore` that modifies dependencies or build config.

## Issue Context

If an issue ID is provided in the prompt, add a `Ref: XXXX` footer (local filesystem issue ID, not GitHub number). Otherwise omit it.

## Workflow

1. Run `git status` and `git diff --staged` (and `git diff` for unstaged changes).
2. Run `git log --oneline -10` for recent commit style context.
3. Analyze the changes — understand what and why.
4. If the repo is task-backed, inspect the `.task/` diff explicitly and map related tracker artifacts to the same logical slices as the code/docs they describe.
5. **Plan the full commit set before starting.** Identify every logical boundary present in the current diff, especially when `/skill:code` has completed multiple verified slices in one run.
6. **Group changes into logical commits.** Each commit should be one coherent unit of work. Split by purpose, not by file. For example, a bug fix and a refactor in the same file are two commits; related changes across multiple files are one commit.
7. For each logical commit:
   a. Pick the appropriate **type** and optional **scope**.
   b. Write a clear **description** in imperative mood ("add", not "added").
   c. Add a **body** only if the why isn't obvious.
   d. Decide whether to add `[skip ci]`.
   e. Stage only the files/hunks for this commit (use explicit file names or careful interactive staging; never `git add -A`).
   f. In task-backed repos, stage the related `.task` files with that same logical slice.
   g. Commit using a HEREDOC:
      ```bash
      git commit -m "$(cat <<'EOF'
      type(scope): description

      Optional body.
      EOF
      )"
      ```
      Do not add a default `Co-Authored-By` footer. Only include attribution footers if the user explicitly asks for them.
8. Run `git status --short` after all commits.
9. If invoked from `/skill:code`, treat a non-empty status here as failure to finish the commit pass. Either:
   - create the remaining logical commit(s), or
   - if leftovers are not meant to be preserved, stop and report that the caller must decide whether to revert/discard them.

   Do not claim completion while verified work is still sitting uncommitted in the tree.

## Reporting

When one commit is created, report:
- short hash
- full subject line
- final `git status --short` result (`clean` when empty)

When multiple commits are created, report:
- each short hash, in creation order
- each full subject line
- a brief note for each commit describing the logical slice it captured
- the final commit hash called out explicitly, since `/skill:code` may need it
  for `code-history`
- final `git status --short` result (`clean` when empty)

Never substitute prompt attachment paths, clipboard temp files, or other
unrelated context for the final git status.

If no commit is created, say so explicitly and include why.
