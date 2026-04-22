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
- Repo-specific workflow customization belongs in \`doc/task-workflow.md\`
  and in project-native docs when they exist.
- Useful optional docs for these packaged skills include:
  - \`doc/planning.md\`
  - \`doc/debugging.md\`
  - \`doc/refactoring.md\`
  - \`doc/coding.md\`
  - \`doc/committing.md\`
  - \`doc/testing.md\`
  - \`doc/decomposition.md\`
  - \`doc/deployment.md\`

## Hard rules

- Prefer \`task\` from \`PATH\`, not hand-editing \`.task/\`.
- Use documented document commands: \`set\`, \`get\`, \`delete\`, and \`show --include-keys\`.
- Use \`--flag value\`, never \`--flag=value\`.
- Keep larger workflow artifacts in issue documents, not metadata.
- Treat \`.task/\` as first-class committed project data.
- When code/docs correspond to issue/task/history changes, commit the related \`.task\` changes in the same logical commit.
- Exclude only clearly unrelated tracker churn from a task-backed commit.
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
| \`commit\` | no | git diff, staged state, related \`.task/*\` changes, optional workflow docs | git commits that include related \`.task/*\` state | verified logical slices are committed with matching tracker history | return to caller |
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
commit
  ↓
code-history/* + task-status/* + related .task/*
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
  const files: Array<[string, string]> = [["doc/task-workflow.md", docTaskWorkflow(detectedCommands)]]

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
      "Add project-native docs such as doc/coding.md, doc/committing.md, doc/testing.md, or doc/deployment.md only when this repo actually needs them.",
    ],
  }
}
