# Local rules for `/skill:commit`

## Local commit contract

- In this repo, `.task/` is part of the committed source of truth.
- Inspect `.task/` changes alongside code and docs during commit planning.
- Include related `.task` issue/task/history artifacts in the same logical commit as the code/docs they describe.
- Exclude only clearly unrelated tracker churn.
- If it is ambiguous whether a `.task` change belongs with the commit, stop and ask instead of silently omitting it.

## Local tracked-work rules

- A tracked `/skill:code` slice is not complete until its related `.task` updates are committed.
- Do not leave related `.task` changes behind when returning from `/skill:code`.
- Keep the git tree clean after the full commit pass.
