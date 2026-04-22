import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import type { CommandArgs, JsonValue, StringMap } from "./types"
import type { IssueMetadata, IssueRecord } from "./tracker/events"
import {
  closeTrackedIssue,
  createTrackedIssue,
  getTrackedIssueNextPhase,
  listTrackedIssues,
  loadArchivedTrackedIssue,
  loadTrackedIssue,
  searchTrackedIssues,
  setTrackedIssueMetadata,
  setTrackedIssuePhase,
  updateTrackedIssueArrayField,
} from "./tracker/issues"
import { listHierarchyChildren, listHierarchyParents } from "./tracker/hierarchy"
import { importLegacyTracker } from "./tracker/migrate"
import {
  COMPACT_LIST_FIELDS,
  COMPACT_RELATED_FIELDS,
  COMPACT_SHOW_FIELDS,
  loadIssueRecord,
  matchesText,
  optionalFlag,
  parseLimit,
  parseSort,
  pickFields,
  projectIssueRecord,
  projectRelatedIssueRecord,
  requireFlag,
  resolveIssue,
  resolveOutputFields,
  sortIssues,
  type IssueCloseResult,
  type IssueMetaGetResult,
  type IssueProjectionOutput,
  type IssueShowResult,
  type RelatedIssueProjection,
  type RelatedIssueProjectionOutput,
} from "./commands-shared"

export { requireFlag, resolveIssue } from "./commands-shared"
export { documentDelete, documentGet, documentSet } from "./commands-document"
export { readAllStdin, storeDelete, storeGet, storeKeys, storeSet } from "./commands-store"

function parseIntegerFlag(raw: string, flag: string): number {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) {
    throw new Error(`${flag} must be an integer`)
  }
  return parsed
}

function valuesFromFlag(value: CommandArgs[keyof CommandArgs]): string[] {
  if (value === undefined) {
    return []
  }
  return Array.isArray(value) ? [...value] : [value]
}

function applyLimit<T>(values: readonly T[], limit: number | undefined): T[] {
  return limit === undefined ? [...values] : values.slice(0, limit)
}

async function loadHierarchyMatches(
  issueIds: readonly string[],
  root: string
): Promise<IssueRecord[]> {
  return (await Promise.all(issueIds.map((issueId) => loadIssueRecord(root, issueId))))
    .filter((issue): issue is IssueRecord => issue !== null)
}

export async function issueCreate(
  args: CommandArgs,
  root: string
): Promise<IssueRecord> {
  const title = requireFlag(args, "--title")
  const description = optionalFlag(args, "--description") ?? ""
  const githubIssueRaw = optionalFlag(args, "--github-issue")
  const priorityRaw = optionalFlag(args, "--priority")
  const labels = valuesFromFlag(args["--label"])
  const parentRaw = optionalFlag(args, "--parent")

  return createTrackedIssue(root, {
    title,
    description,
    priority: priorityRaw === undefined ? 2 : parseIntegerFlag(priorityRaw, "--priority"),
    labels,
    ...(githubIssueRaw === undefined
      ? {}
      : { githubIssue: parseIntegerFlag(githubIssueRaw, "--github-issue") }),
    ...(parentRaw === undefined ? {} : { parentRef: parentRaw }),
  })
}

export async function issueShow(
  args: CommandArgs,
  root: string
): Promise<IssueShowResult> {
  const id = requireFlag(args, "--id")
  const { path, archived } = resolveIssue(id, root)
  const issue = archived
    ? loadArchivedTrackedIssue(root, basename(path))
    : await loadTrackedIssue(root, basename(path))

  const fields = resolveOutputFields(args, COMPACT_SHOW_FIELDS)
  const includeKeys = args["--include-keys"] !== undefined
    || args["--include-stores"] !== undefined
    || (args["--summary"] === undefined && fields === undefined)
  if (includeKeys) {
    return {
      id: issue.id,
      metadata: pickFields(issue.metadata, fields),
      keys: issue.keys,
    }
  }

  return {
    id: issue.id,
    metadata: pickFields(issue.metadata, fields),
  }
}

export async function issueList(
  args: CommandArgs,
  root: string
): Promise<IssueProjectionOutput[]> {
  const includeAll = args["--all"] !== undefined
  const whereRaw = args["--where"]
  const conditions: Array<[string, string]> = []

  if (whereRaw !== undefined) {
    const items = Array.isArray(whereRaw) ? whereRaw : [whereRaw]
    for (const item of items) {
      const eqIdx = item.indexOf("=")
      if (eqIdx === -1) {
        continue
      }
      conditions.push([item.slice(0, eqIdx), item.slice(eqIdx + 1)])
    }
  }

  const labelFilters = valuesFromFlag(args["--label"])
  const textFilter = optionalFlag(args, "--text")?.trim().toLowerCase()
  const fields = resolveOutputFields(args, COMPACT_LIST_FIELDS, true)
  const limit = parseLimit(args)
  const sort = parseSort(args)

  const results = (await listTrackedIssues(root, includeAll)).filter((issue) => {
    for (const [key, value] of conditions) {
      if (String(issue[key]) !== value) {
        return false
      }
    }

    if (labelFilters.length > 0) {
      for (const label of labelFilters) {
        if (!issue.labels.includes(label)) {
          return false
        }
      }
    }

    if (textFilter !== undefined && !matchesText(issue, textFilter)) {
      return false
    }

    return true
  })

  return applyLimit(sortIssues(results, sort), limit)
    .map((issue) => projectIssueRecord(issue, fields))
}

export async function issueChildren(
  args: CommandArgs,
  root: string
): Promise<IssueProjectionOutput[]> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  const targetId = basename(path)
  const fields = resolveOutputFields(args, COMPACT_LIST_FIELDS, true)
  const includeAll = args["--all"] !== undefined
  const limit = parseLimit(args)
  const sort = parseSort(args)

  const matches = (await loadHierarchyMatches(
    await listHierarchyChildren(root, targetId, includeAll),
    root
  )).filter((issue) => includeAll || issue.status !== "closed")

  return applyLimit(sortIssues(matches, sort), limit).map((issue) => projectIssueRecord(issue, fields))
}

export async function issueParents(
  args: CommandArgs,
  root: string
): Promise<IssueProjectionOutput[]> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  const targetId = basename(path)
  const fields = resolveOutputFields(args, COMPACT_LIST_FIELDS, true)
  const limit = parseLimit(args)
  const sort = parseSort(args)

  const parents = await loadHierarchyMatches(await listHierarchyParents(root, targetId), root)
  return applyLimit(sortIssues(parents, sort), limit).map((issue) => projectIssueRecord(issue, fields))
}

export async function issueSearch(
  args: CommandArgs,
  root: string
): Promise<IssueProjectionOutput[]> {
  const positional = args["_"]
  const positionalArgs = positional === undefined ? [] : Array.isArray(positional) ? [...positional] : [positional]
  const queryFromPositional = positionalArgs.join(" ").trim()
  const queryFromFlag = optionalFlag(args, "--text")?.trim()
  const query = queryFromFlag !== undefined && queryFromFlag.length > 0 ? queryFromFlag : queryFromPositional
  if (query.length === 0) {
    throw new Error("search query is required (pass positional text or --text)")
  }

  const filteredArgs: CommandArgs = { ...args, "--text": query }
  delete filteredArgs["_"]
  delete filteredArgs["--text"]

  const fields = resolveOutputFields(filteredArgs, COMPACT_LIST_FIELDS, true)
  const limit = parseLimit(filteredArgs)
  const sort = parseSort(filteredArgs)
  const results = await searchTrackedIssues(root, args["--all"] !== undefined, query)
  return applyLimit(sortIssues(results, sort), limit).map((issue) => projectIssueRecord(issue, fields))
}

export async function issueRelated(
  args: CommandArgs,
  root: string
): Promise<RelatedIssueProjectionOutput[]> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  const targetId = basename(path)
  const includeAll = args["--all"] !== undefined
  const fields = resolveOutputFields(args, COMPACT_RELATED_FIELDS, true)
  const limit = parseLimit(args)
  const sort = parseSort(args)
  const related = new Map<string, RelatedIssueProjection>()

  for (const parent of await loadHierarchyMatches(await listHierarchyParents(root, targetId), root)) {
    related.set(parent.id, { ...parent, relation: "parent" })
  }

  for (const child of (await loadHierarchyMatches(
    await listHierarchyChildren(root, targetId, includeAll),
    root
  )).filter((issue) => includeAll || issue.status !== "closed")) {
    const existing = related.get(child.id)
    related.set(child.id, existing === undefined ? { ...child, relation: "child" } : { ...existing, relation: "both" })
  }

  return applyLimit(sortIssues([...related.values()], sort), limit).map((issue) =>
    projectRelatedIssueRecord(issue, fields)
  )
}

export async function issueClose(
  args: CommandArgs,
  root: string
): Promise<IssueCloseResult> {
  const id = requireFlag(args, "--id")
  const { path: issuePath, archived } = resolveIssue(id, root)
  if (archived) {
    return { already_closed: true }
  }
  return closeTrackedIssue(root, basename(issuePath))
}

export async function issueMetaSet(
  args: CommandArgs,
  root: string
): Promise<IssueMetadata> {
  const id = requireFlag(args, "--id")
  const key = requireFlag(args, "--key")
  const value = requireFlag(args, "--value")
  const { path: issuePath } = resolveIssue(id, root)
  return setTrackedIssueMetadata(root, basename(issuePath), key, value)
}

export async function issueMetaGet(
  args: CommandArgs,
  root: string
): Promise<IssueMetaGetResult> {
  const id = requireFlag(args, "--id")
  const key = requireFlag(args, "--key")
  const { path, archived } = resolveIssue(id, root)
  const issue = archived
    ? loadArchivedTrackedIssue(root, basename(path))
    : await loadTrackedIssue(root, basename(path))
  return { value: issue.metadata[key] ?? null }
}

export async function issuePhaseNext(
  args: CommandArgs,
  root: string
): Promise<{ value: string }> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  return { value: await getTrackedIssueNextPhase(root, basename(path)) }
}

export async function issuePhaseSet(
  args: CommandArgs,
  root: string
): Promise<IssueMetadata> {
  const id = requireFlag(args, "--id")
  const value = requireFlag(args, "--value")
  const { path } = resolveIssue(id, root)
  return setTrackedIssuePhase(root, basename(path), value)
}

export async function legacyImport(
  args: CommandArgs,
  root: string
): Promise<Awaited<ReturnType<typeof importLegacyTracker>>> {
  return importLegacyTracker(root, requireFlag(args, "--source"))
}

export async function updateArrayField(
  args: CommandArgs,
  field: string,
  root: string
): Promise<{ id: string; field: string; values: string[] }> {
  const id = requireFlag(args, "--id")
  const addRaw = args["--add"]
  const removeRaw = args["--remove"]

  if (addRaw === undefined && removeRaw === undefined) {
    throw new Error("At least one of --add or --remove is required")
  }
  if (field !== "labels" && field !== "refs") {
    throw new Error(`Unsupported array field '${field}'`)
  }

  const toAdd = valuesFromFlag(addRaw)
  const toRemove = valuesFromFlag(removeRaw)
  const { path: issuePath } = resolveIssue(id, root)
  return updateTrackedIssueArrayField(root, basename(issuePath), field, toAdd, toRemove)
}

type BootstrapDetectedCommands = {
  test: string
  lint: string
  typecheck: string
  diffLint: string
  checkWorkflowGate: string
}

type BootstrapResult = {
  root: string
  created: string[]
  skipped: string[]
  detectedCommands: BootstrapDetectedCommands
  todos: string[]
}

function loadPackageJson(root: string): StringMap<JsonValue> | null {
  const path = join(root, "package.json")
  if (!existsSync(path)) {
    return null
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null
    }
    return parsed as StringMap<JsonValue>
  } catch {
    return null
  }
}

function stringProperty(object: StringMap<JsonValue> | null, key: string): string | undefined {
  const value = object?.[key]
  return typeof value === "string" ? value : undefined
}

function objectProperty(
  object: StringMap<JsonValue> | null,
  key: string
): StringMap<JsonValue> | null {
  const value = object?.[key]
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null
  }
  return value as StringMap<JsonValue>
}

function detectRunner(root: string, packageJson: StringMap<JsonValue> | null): string {
  const packageManager = stringProperty(packageJson, "packageManager")
  if (packageManager?.startsWith("bun@") === true) return "bun run"
  if (packageManager?.startsWith("pnpm@") === true) return "pnpm run"
  if (packageManager?.startsWith("yarn@") === true) return "yarn"
  if (packageManager?.startsWith("npm@") === true) return "npm run"

  if (existsSync(join(root, "bun.lock")) || existsSync(join(root, "bun.lockb"))) return "bun run"
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm run"
  if (existsSync(join(root, "yarn.lock"))) return "yarn"
  if (existsSync(join(root, "package-lock.json"))) return "npm run"
  return "npm run"
}

function detectScriptCommand(
  root: string,
  packageJson: StringMap<JsonValue> | null,
  scriptName: string
): string {
  const scripts = objectProperty(packageJson, "scripts")
  if (scripts === null || stringProperty(scripts, scriptName) === undefined) {
    return "Not configured"
  }
  return `${detectRunner(root, packageJson)} ${scriptName}`
}

function docTaskWorkflow(commands: BootstrapDetectedCommands): string {
  return `# Task Workflow Conventions for This Repo

This repo's workflow skills are intentionally **task-backed**.
Use the \`task\` CLI from \`PATH\` inside this repo.

## Workflow philosophy

- \`task\` is the workflow substrate, not a side tool.
- Durable workflow state belongs in \`task\` issue documents and metadata.
- Workflow skills should coordinate through canonical issue-document paths, not
  ad hoc files or hidden bookkeeping.
- Repo-specific workflow customization belongs in:
  - \`doc/task-workflow.md\`
  - \`doc/skill-task.md\`
  - \`doc/skill-feature.md\`
  - \`doc/skill-debug.md\`
  - \`doc/skill-refactor.md\`
  - \`doc/skill-code.md\`
  - \`doc/skill-check.md\`
  - \`doc/skill-taskify.md\`
  - \`doc/skill-deploy.md\`

## Hard rules

- Prefer \`task\` from \`PATH\`, not hand-editing \`.task/\`.
- Use documented document commands: \`set\`, \`get\`, \`delete\`, and \`show --include-keys\`.
- Use \`--flag value\`, never \`--flag=value\`.
- Keep larger workflow artifacts in issue documents, not metadata.
- Use exact handoff commands. Do not hand off with only a bare skill name when the next command is knowable.

## Canonical issue document paths

These key names are the canonical workflow surface:

- \`research/prd\`
- \`research/plan\`
- \`research/diagnosis\`
- \`research/diagnosis-retry-N\`
- \`research/refactor-plan\`
- \`research/retro-<slug>\`
- \`tasks/NN-<slug>\`
- \`task-status/NN-<slug>\`
- \`code-history/run-00N\`
- \`code-history/latest\`
- \`check-report/run-00N\`
- \`check-report/latest\`
- \`taskify-history/run-00N\`
- \`taskify-history/latest\`
- \`qa-results/<qa-key>\`
- \`qa-context/<qa-key>\`

## Standard naming and status conventions

### Task keys

- executable task keys are zero-padded \`NN-<slug>\`

### Run keys

- history/report runs are zero-padded \`run-00N\`

### Pointer keys

- append-only history stores also have a mutable \`latest\` pointer document
- current pointer stores are:
  - \`code-history/latest\`
  - \`check-report/latest\`
  - \`taskify-history/latest\`

### Task-status values

- absence of a \`task-status/<task-key>\` document means \`pending\`
- success: \`done\`
- failure: \`failed:<short reason>\`

## Standard handoff commands

When the next step is known, use one of these exact forms:

- \`Next: /skill:taskify <id> --from plan\`
- \`Next: /skill:taskify <id> --from check\`
- \`Next: /skill:code <id> <task-key>\`
- \`Next: /skill:code <id>\`
- \`Next: /skill:check --issue <id>\`
- \`Next: /skill:qa <id>\`
- \`Next: /skill:debug <id>\`
- \`Next: /skill:feature <id>\`
- \`Next: /skill:refactor <id>\`

## Read / inspect patterns

Use these commands to inspect issue-backed workflow state:

\`\`\`bash
task show --id <id> --compact
task show --id <id> --include-keys
task get --id <id> --key research/
task get --id <id> --key tasks/
task get --id <id> --key task-status/
task get --id <id> --key code-history/
task get --id <id> --key check-report/
task get --id <id> --key taskify-history/
task get --id <id> --key /
\`\`\`

## Write patterns

\`\`\`bash
task set --id <id> --key research/plan --file /tmp/plan.md
task set --id <id> --key tasks/01-example-task --file /tmp/task.md
task set --id <id> --key task-status/01-example-task --value done
task set --id <id> --key code-history/latest --file /tmp/latest.md
\`\`\`

## Skill ownership and workflow matrix

| Skill | Creates issue | Reads | Writes | Completion signal | Standard handoff |
|---|---|---|---|---|---|
| \`feature\` | yes, when needed | current issue, \`research/*\` | \`research/prd\`, \`research/plan\` | both docs written | \`Next: /skill:taskify <id> --from plan\` |
| \`debug\` | yes, when needed | current issue, \`research/*\`, \`tasks/*\`, \`task-status/*\`, \`qa-results/*\`, \`qa-context/*\`, \`check-report/*\`, \`code-history/*\` | \`research/diagnosis*\`, optional \`research/plan\`, optional \`research/retro-*\` | diagnosis written; plan written when implementation-ready | \`Next: /skill:taskify <id> --from plan\` or \`Next: /skill:feature <id>\` or \`Next: /skill:refactor <id>\` |
| \`refactor\` | yes, when needed | current issue, \`research/*\` | \`research/refactor-plan\`, \`research/plan\` | both docs written | \`Next: /skill:taskify <id> --from plan\` |
| \`taskify\` | no | \`research/plan\`, \`tasks/*\`, \`task-status/*\`, \`taskify-history/*\`, optional \`check-report/*\`, optional \`code-history/*\` | \`tasks/NN-*\`, \`taskify-history/run-*\`, \`taskify-history/latest\` | new task batch + taskify history written | \`Next: /skill:code <id> <first-new-task-key>\` |
| \`code\` | no | \`research/plan\`, \`tasks/*\`, \`task-status/*\`, \`taskify-history/*\`, \`code-history/*\`, optional \`check-report/*\` | \`task-status/*\`, \`code-history/run-*\`, \`code-history/latest\` | one runnable task-sized slice completed and recorded | \`Next: /skill:code <id> <next-task-key>\` or \`Next: /skill:check --issue <id>\` |
| \`check\` | no | \`research/plan\`, \`tasks/*\`, \`task-status/*\`, \`code-history/*\`, \`check-report/*\` | \`check-report/run-*\`, \`check-report/latest\` | new check report written | \`Next: /skill:qa <id>\` or \`Next: /skill:taskify <id> --from check\` or \`Next: /skill:debug <id>\` |
| \`deploy\` | no | \`check-report/*\`, \`tasks/*\`, \`task-status/*\`, \`qa-results/*\`, \`qa-context/*\` | none | deploy summary reported | none |

## Workflow spine

\`\`\`text
feature | debug | refactor
  ↓
research/plan
  ↓
taskify
  ↓
tasks/*
  ↓
code
  ↓
code-history/* + task-status/*
  ↓
check
  ↓
check-report/*
  ↓
qa (when used)
  ↓
deploy
\`\`\`

## Repo verification commands

- Tests: \`${commands.test}\`
- Lint: \`${commands.lint}\`
- Typecheck: \`${commands.typecheck}\`
- Diff lint: \`${commands.diffLint}\`
- Check workflow gate: \`${commands.checkWorkflowGate}\`

If the repo uses a custom diff lint or workflow gate, edit this file and add the
exact commands here.
`
}

function docSkillTask(): string {
  return `# Local rules for \`/skill:task\`

## Local rules

- Use \`task\` from \`PATH\`.
- Treat \`doc/task-workflow.md\` as the shared workflow reference.
- Use \`doc/skill-task.md\` only for task-specific refinements.
- Prefer repo docs when they define stricter or more specific task usage rules.
`
}

function docSkillFeature(): string {
  return `# Local rules for \`/skill:feature\`

## Local workflow contract

- Prefer issue-backed mode.
- Use \`task\` from \`PATH\`.
- Reuse the current issue when one is already in play; otherwise create one with label \`prd\`.
- Persist the PRD at \`research/prd\`.
- Persist the approved implementation handoff at \`research/plan\`.
- Inspect existing research with \`task show --id <id> --include-keys\` and \`task get --id <id> --key research/\`.
- Write artifacts with:
  - \`task set --id <id> --key research/prd --file /tmp/prd.md\`
  - \`task set --id <id> --key research/plan --file /tmp/plan.md\`
- Do not claim completion until both writes succeed.
- End with exactly: \`Next: /skill:taskify <id> --from plan\`
`
}

function docSkillDebug(): string {
  return `# Local rules for \`/skill:debug\`

## Local workflow contract

- Prefer issue-backed mode once the bug is framed.
- Use \`task\` from \`PATH\`.
- Create a new issue with label \`bug\` when there is no active issue.
- Read existing durable context from \`research/\`, \`tasks/\`, \`task-status/\`, \`qa-results/\`, \`qa-context/\`, \`check-report/\`, and \`code-history/\`.
- Store the first diagnosis at \`research/diagnosis\`.
- Store later retries at \`research/diagnosis-retry-N\`.
- Store the approved implementation handoff at \`research/plan\` when the disposition is implementation-ready.
- Store QA retrospectives at \`research/retro-<slug>\`.
- Use \`task set --id <id> --key <path> --file /tmp/<file>.md\` for durable writes.

## Local handoffs

End with exactly one of:
- \`Next: /skill:taskify <id> --from plan\`
- \`Next: /skill:feature <id>\`
- \`Next: /skill:refactor <id>\`
`
}

function docSkillRefactor(): string {
  return `# Local rules for \`/skill:refactor\`

## Local workflow contract

- Use workflow mode.
- Use \`task\` from \`PATH\`.
- Reuse the active issue when present; otherwise create one with label \`refactor\`.
- Persist the planning artifact at \`research/refactor-plan\`.
- Persist the approved coding handoff at \`research/plan\`.
- Inspect current research with \`task show --id <id> --include-keys\` and \`task get --id <id> --key research/\`.
- Write artifacts with:
  - \`task set --id <id> --key research/refactor-plan --file /tmp/refactor-plan.md\`
  - \`task set --id <id> --key research/plan --file /tmp/plan.md\`
- End with exactly: \`Next: /skill:taskify <id> --from plan\`
`
}

function docSkillCode(): string {
  return `# Local rules for \`/skill:code\`

## Local tracked mode contract

- Tracked runs are issue-backed and document-backed.
- Read durable context from \`research/plan\`, \`tasks/\`, \`task-status/\`, \`code-history/\`, \`taskify-history/\`, and \`check-report/\` via \`task get\`.
- Use \`task show --id <id> --include-keys\` to discover the current document graph.
- Mark task completion with \`task-status/<task-key>\` documents, using values like \`done\` or \`failed:<reason>\`.
- Append run records under \`code-history/run-00N\` and refresh \`code-history/latest\`.
- Keep one runnable task-sized slice per session.
- Keep the git tree clean before and after the run.

## Local verification commands

Use the exact commands listed in \`doc/task-workflow.md\` under \`## Repo verification commands\`.

## Local handoff rules

- More runnable implementation work => hand off to \`/skill:code <id> <next-task-key>\` when clear.
- Implementation complete => hand off to \`/skill:check --issue <id>\`.
- Persist the exact next command in the \`code-history\` record.
`
}

function docSkillCheck(): string {
  return `# Local rules for \`/skill:check\`

## Local gates

Use the exact commands listed in \`doc/task-workflow.md\` under \`## Repo verification commands\`, then run:

\`\`\`text
/skill:global-review --branch
\`\`\`

## Local issue-backed context

When an issue is in play, read durable context from:
- \`tasks/\`
- \`task-status/\`
- \`code-history/\`
- \`check-report/\`

Use \`task get\` and \`task show --id <id> --include-keys\`.

## Local reports

- Append full reports under \`check-report/run-00N\`.
- Refresh the pointer at \`check-report/latest\`.
- Even passing runs must write both documents.

## Local handoffs

- passing issue-backed run => \`Next: /skill:qa <id>\`
- failing issue-backed run with clear repair slices => \`Next: /skill:taskify <id> --from check\`
- failing issue-backed run needing diagnosis => \`Next: /skill:debug <id>\`
`
}

function docSkillTaskify(): string {
  return `# Local rules for \`/skill:taskify\`

## Local document paths

Use these canonical issue document paths:
- approved handoff source: \`research/plan\`
- latest check pointer/report: \`check-report/latest\`, \`check-report/run-00N\`
- task bodies: \`tasks/NN-<slug>\`
- live task state: \`task-status/NN-<slug>\`
- taskification history: \`taskify-history/run-00N\`, \`taskify-history/latest\`
- prior coding context: \`code-history/\`

## Local read / write rules

- Discover existing documents with \`task show --id <id> --include-keys\`.
- Read task and history trees with \`task get --id <id> --key tasks/\` and \`task get --id <id> --key taskify-history/\`.
- Write each new task with \`task set --id <id> --key tasks/<NN-key> --file /tmp/<NN-key>.md\`.
- Read back each newly written task before continuing.
- Write history records with \`task set\` under \`taskify-history/...\`.
- Do not rewrite earlier task bodies; append new numbered tasks instead.

## Local handoffs

- successful issue-backed decomposition => \`Next: /skill:code <id> <first-new-task-key>\` when clear, else \`Next: /skill:code <id>\`
- blocked by debug-first policy or repair-loop cap => \`Next: /skill:debug <id>\`
`
}

function docSkillDeploy(): string {
  return `# Local rules for \`/skill:deploy\`

## Local readiness evidence

When an issue is available, inspect durable workflow evidence through document
paths:
- \`check-report/latest\`
- \`check-report/\`
- \`tasks/\`
- \`task-status/\`
- \`qa-results/\`
- \`qa-context/\`

Use \`task get --id <id> --key <path-or-subtree>\` and \`task show --id <id> --include-keys\`.

## Local verification expectations

- A latest passing \`check-report\` is required for a clean automated-readiness pass.
- Missing or failed QA evidence is not a silent pass.
- If the repo has \`doc/deployment.md\`, treat it as the authoritative project-specific shipping guide.

## Local write policy

- Keep deploy read-only with respect to issue documents.
- Do not mutate workflow artifacts from this skill.
`
}

function writeBootstrapFile(
  targetRoot: string,
  relativePath: string,
  content: string,
  force: boolean,
  created: string[],
  skipped: string[]
): void {
  const path = join(targetRoot, relativePath)
  if (existsSync(path) && !force) {
    skipped.push(path)
    return
  }

  mkdirSync(join(path, ".."), { recursive: true })
  writeFileSync(path, `${content.trimEnd()}\n`, "utf8")
  created.push(path)
}

function bootstrapTargetRoot(args: CommandArgs, root: string): string {
  const raw = optionalFlag(args, "--root")
  return raw === undefined ? root : resolve(root, raw)
}

export async function workflowBootstrap(
  args: CommandArgs,
  root: string
): Promise<BootstrapResult> {
  const targetRoot = bootstrapTargetRoot(args, root)
  const force = args["--force"] !== undefined
  const packageJson = loadPackageJson(targetRoot)
  const detectedCommands: BootstrapDetectedCommands = {
    test: detectScriptCommand(targetRoot, packageJson, "test"),
    lint: detectScriptCommand(targetRoot, packageJson, "lint"),
    typecheck: detectScriptCommand(targetRoot, packageJson, "typecheck"),
    diffLint: "Not configured",
    checkWorkflowGate: "Not configured",
  }

  const created: string[] = []
  const skipped: string[] = []
  const files: Array<[string, string]> = [
    ["doc/task-workflow.md", docTaskWorkflow(detectedCommands)],
    ["doc/skill-task.md", docSkillTask()],
    ["doc/skill-feature.md", docSkillFeature()],
    ["doc/skill-debug.md", docSkillDebug()],
    ["doc/skill-refactor.md", docSkillRefactor()],
    ["doc/skill-code.md", docSkillCode()],
    ["doc/skill-check.md", docSkillCheck()],
    ["doc/skill-taskify.md", docSkillTaskify()],
    ["doc/skill-deploy.md", docSkillDeploy()],
  ]

  for (const [relativePath, content] of files) {
    writeBootstrapFile(targetRoot, relativePath, content, force, created, skipped)
  }

  return {
    root: targetRoot,
    created,
    skipped,
    detectedCommands,
    todos: [
      "Review doc/task-workflow.md and update verification commands if the detected scripts are incomplete.",
      "If the repo uses a custom diff lint or workflow gate, add the exact commands under 'Repo verification commands'.",
      "Adjust any doc/skill-*.md handoffs or artifact paths if the repo uses a different workflow.",
    ],
  }
}
