# QA retrospective — invalid paths and help surface

1. **Was this case in the planning artifacts?**
   Yes. The approved PRD/plan says the supported surface is `task set|get|delete`, lists legacy `task store ...` compatibility as a non-goal, and explicitly calls out help/examples as human QA scope.

2. **Was there an execution task for it?**
   Partially, but incompletely. Task `02-document-command-surface` covered only the in-progress `src/` CLI surface and did not own the repo-root entrypoint or the root `doc/` docs that users still read.

3. **Did implementation diverge?**
   Yes. The implementation matched the narrowed `src/` task but diverged from the broader approved user-facing contract by leaving `task.ts`, `commands.ts`, and multiple docs on the legacy `store` model.

4. **Did verification miss it?**
   Yes. Automated tests asserted the `src/` help surface only. Root help and documentation parity were not covered, so branch-level checks passed while QA still failed.

5. **Has this bug family appeared before?**
   No earlier tracked issue was found, but it belongs to the broader staged-rewrite drift family: duplicated root and `src/` surfaces diverge because only one gets updated and tested.
