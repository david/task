import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  existsSync,
} from "node:fs"
import { join, basename } from "node:path"
import type { Command } from "./types"
import { detectRepoRoot, getArchiveRoot, getIssueRoot, listCanonicalIssueIds } from "./tracker/root"
import {
  createTrackedIssue,
  listTrackedIssues,
  loadArchivedTrackedIssue,
  loadTrackedIssue,
  searchTrackedIssues,
} from "./tracker/issues"
import { listHierarchyChildren, listHierarchyParents } from "./tracker/hierarchy"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function requireFlag(
  args: Record<string, string | string[] | undefined>,
  flag: string
): string {
  const val = args[flag]
  if (val === undefined) throw new Error(`${flag} is required`)
  return Array.isArray(val) ? val[0] : val
}

function listDirsWithPrefix(dir: string, prefix: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(
    (entry) => entry.startsWith(prefix + "-") && statSync(join(dir, entry)).isDirectory()
  )
}

const COMPACT_LIST_FIELDS = ["id", "title", "status", "phase", "priority", "refs"]
const COMPACT_SHOW_FIELDS = [
  "title",
  "status",
  "phase",
  "priority",
  "created",
  "updated",
  "refs",
  "labels",
  "github_issue",
]
const COMPACT_RELATED_FIELDS = ["id", "title", "status", "phase", "priority", "relation"]

type SortMode = "priority" | "updated"

export function resolveIssue(
  id: string,
  root: string
): { path: string; archived: boolean } {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid issue ID '${id}': must be lowercase alphanumeric (with optional slug)`)
  }

  // Extract the short prefix (everything before the first hyphen) for matching
  const prefix = id.split("-")[0]

  const issueRoot = getIssueRoot(root)
  const archiveDir = getArchiveRoot(root)

  const archivedIds = new Set<string>(listDirsWithPrefix(archiveDir, prefix))
  const activeIds = new Set<string>(listDirsWithPrefix(issueRoot, prefix))
  for (const issueId of listCanonicalIssueIds(root)) {
    if (issueId.startsWith(prefix + "-") && !archivedIds.has(issueId)) {
      activeIds.add(issueId)
    }
  }

  const activeMatches = [...activeIds].sort().map((d) => ({
    path: join(issueRoot, d),
    archived: false,
  }))
  const archiveMatches = [...archivedIds].sort().map((d) => ({
    path: join(archiveDir, d),
    archived: true,
  }))
  const all = [...activeMatches, ...archiveMatches]

  if (all.length === 0) {
    throw new Error(`Issue '${id}' not found`)
  }
  if (all.length > 1) {
    const list = all.map((m) => basename(m.path)).join(", ")
    throw new Error(`Ambiguous ID '${id}': ${list}`)
  }
  return all[0]
}

function optionalFlag(
  args: Record<string, string | string[] | undefined>,
  flag: string
): string | undefined {
  const val = args[flag]
  if (val === undefined) return undefined
  return Array.isArray(val) ? val[0] : val
}

function parseCsvFlag(
  args: Record<string, string | string[] | undefined>,
  flag: string
): string[] | undefined {
  const raw = args[flag]
  if (raw === undefined) return undefined
  const values = Array.isArray(raw) ? raw : [raw]
  const fields = values.flatMap((value) =>
    value
      .split(",")
      .map((field) => field.trim())
      .filter((field) => field.length > 0)
  )
  return fields.length > 0 ? fields : undefined
}

function parseLimit(
  args: Record<string, string | string[] | undefined>
): number | undefined {
  const raw = optionalFlag(args, "--limit")
  if (raw === undefined) return undefined
  const limit = Number(raw)
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer")
  }
  return limit
}

function parseSort(
  args: Record<string, string | string[] | undefined>
): SortMode {
  const raw = optionalFlag(args, "--sort")
  if (raw === undefined) return "priority"
  if (raw === "priority" || raw === "updated") return raw
  throw new Error("--sort must be one of: priority, updated")
}

function resolveOutputFields(
  args: Record<string, string | string[] | undefined>,
  compactFields: string[],
  defaultCompact = false
): string[] | undefined {
  const explicitFields = parseCsvFlag(args, "--fields")
  if (explicitFields !== undefined) return explicitFields
  if ("--full" in args) return undefined
  if ("--compact" in args || defaultCompact) return compactFields
  return undefined
}

function pickFields(
  source: Record<string, unknown>,
  fields: string[] | undefined
): Record<string, unknown> {
  if (fields === undefined) return { ...source }
  const picked: Record<string, unknown> = {}
  for (const field of fields) {
    if (field in source) {
      picked[field] = source[field]
    }
  }
  return picked
}

function nowIso(): string {
  return new Date().toISOString()
}

function loadIssueMetadata(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))
}

function touchIssueMetadata(data: Record<string, unknown>): Record<string, unknown> {
  data.updated = nowIso()
  return data
}

function loadIssueStores(path: string): Record<string, string[]> {
  const stores: Record<string, string[]> = {}
  const entries = readdirSync(path)
  for (const entry of entries) {
    if (entry === "issue.json") continue
    const entryPath = join(path, entry)
    if (statSync(entryPath).isDirectory()) {
      const keys = readdirSync(entryPath).sort()
      stores[entry] = keys
    }
  }
  return stores
}

function tryLoadIssueRecord(root: string, issueId: string): Record<string, unknown> | null {
  try {
    const resolved = resolveIssue(issueId, root)
    return { id: basename(resolved.path), ...loadIssueMetadata(resolved.path) }
  } catch {
    return null
  }
}

function sortIssues(issues: Record<string, unknown>[], sort: SortMode): Record<string, unknown>[] {
  return [...issues].sort((a, b) => {
    if (sort === "updated") {
      const ua = typeof a.updated === "string" ? a.updated : ""
      const ub = typeof b.updated === "string" ? b.updated : ""
      if (ua === ub) {
        return String(a.id).localeCompare(String(b.id))
      }
      return ub.localeCompare(ua)
    }

    const pa = typeof a.priority === "number" ? a.priority : Infinity
    const pb = typeof b.priority === "number" ? b.priority : Infinity
    if (pa !== pb) return pa - pb
    return String(a.id).localeCompare(String(b.id))
  })
}

function matchesText(issue: Record<string, unknown>, query: string): boolean {
  const haystacks: string[] = []
  for (const key of ["id", "title", "description"]) {
    const value = issue[key]
    if (typeof value === "string") haystacks.push(value)
  }
  for (const key of ["refs", "labels"]) {
    const value = issue[key]
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") haystacks.push(item)
      }
    }
  }
  const normalized = query.toLowerCase()
  return haystacks.some((value) => value.toLowerCase().includes(normalized))
}

function projectIssueRecord(
  issue: Record<string, unknown>,
  fields: string[] | undefined
): Record<string, unknown> {
  return fields === undefined ? issue : pickFields(issue, fields)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export async function issueCreate(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>> {
  const title = requireFlag(args, "--title")
  const description = args["--description"]
    ? (Array.isArray(args["--description"]) ? args["--description"][0] : args["--description"])
    : ""
  const githubIssueRaw = args["--github-issue"]
    ? (Array.isArray(args["--github-issue"]) ? args["--github-issue"][0] : args["--github-issue"])
    : undefined
  const priorityRaw = args["--priority"]
    ? (Array.isArray(args["--priority"]) ? args["--priority"][0] : args["--priority"])
    : undefined
  const labelRaw = args["--label"]
  const labels: string[] = labelRaw
    ? (Array.isArray(labelRaw) ? labelRaw : [labelRaw])
    : []
  const parentRaw = optionalFlag(args, "--parent")

  const issue = await createTrackedIssue(root, {
    title,
    description,
    priority: priorityRaw !== undefined ? Number(priorityRaw) : 2,
    labels,
    ...(githubIssueRaw === undefined ? {} : { githubIssue: Number(githubIssueRaw) }),
    ...(parentRaw === undefined ? {} : { parentRef: parentRaw }),
  })

  return issue
}

export async function issueShow(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<{ id: string; metadata: Record<string, unknown>; stores?: Record<string, string[]> }> {
  const id = requireFlag(args, "--id")
  const { path, archived } = resolveIssue(id, root)
  const issue = archived
    ? loadArchivedTrackedIssue(root, basename(path))
    : await loadTrackedIssue(root, basename(path))

  const fields = resolveOutputFields(args, COMPACT_SHOW_FIELDS)
  const includeStores = "--include-stores" in args || (!("--summary" in args) && fields === undefined)
  const result: { id: string; metadata: Record<string, unknown>; stores?: Record<string, string[]> } = {
    id: issue.id,
    metadata: pickFields(issue.metadata, fields),
  }

  if (includeStores) {
    result.stores = issue.stores
  }

  return result
}

export async function issueList(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>[]> {
  const includeAll = "--all" in args
  const whereRaw = args["--where"]
  const conditions: Array<[string, string]> = []

  if (whereRaw !== undefined) {
    const items = Array.isArray(whereRaw) ? whereRaw : [whereRaw]
    for (const item of items) {
      const eqIdx = item.indexOf("=")
      if (eqIdx === -1) continue
      conditions.push([item.slice(0, eqIdx), item.slice(eqIdx + 1)])
    }
  }

  const labelRaw = args["--label"]
  const labelFilters: string[] = labelRaw
    ? (Array.isArray(labelRaw) ? labelRaw : [labelRaw])
    : []
  const textFilter = optionalFlag(args, "--text")?.trim().toLowerCase()
  const fields = resolveOutputFields(args, COMPACT_LIST_FIELDS, true)
  const limit = parseLimit(args)
  const sort = parseSort(args)

  const results = (await listTrackedIssues(root, includeAll)).filter((issue) => {
    const issueRecord = issue as Record<string, unknown>

    for (const [key, value] of conditions) {
      if (String(issueRecord[key]) !== value) {
        return false
      }
    }

    if (labelFilters.length > 0) {
      const issueLabels: string[] = Array.isArray(issue.labels) ? issue.labels : []
      for (const lbl of labelFilters) {
        if (!issueLabels.includes(lbl)) {
          return false
        }
      }
    }

    if (textFilter && !matchesText(issue, textFilter)) {
      return false
    }

    return true
  })

  const sortedResults = sortIssues(results, sort)
  const limitedResults = limit === undefined ? sortedResults : sortedResults.slice(0, limit)
  return limitedResults.map((issue) => projectIssueRecord(issue, fields))
}

export async function issueChildren(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>[]> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  const targetId = basename(path)
  const fields = resolveOutputFields(args, COMPACT_LIST_FIELDS, true)
  const includeAll = "--all" in args
  const limit = parseLimit(args)
  const sort = parseSort(args)

  const matches = (await listHierarchyChildren(root, targetId, includeAll))
    .map((childId) => tryLoadIssueRecord(root, childId))
    .filter((issue): issue is Record<string, unknown> => issue !== null)

  const sortedMatches = sortIssues(matches, sort)
  const limitedMatches = limit === undefined ? sortedMatches : sortedMatches.slice(0, limit)
  return limitedMatches.map((issue) => projectIssueRecord(issue, fields))
}

export async function issueParents(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>[]> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  const targetId = basename(path)
  const fields = resolveOutputFields(args, COMPACT_LIST_FIELDS, true)
  const limit = parseLimit(args)
  const sort = parseSort(args)

  const parents = (await listHierarchyParents(root, targetId))
    .map((parentId) => tryLoadIssueRecord(root, parentId))
    .filter((issue): issue is Record<string, unknown> => issue !== null)

  const sortedParents = sortIssues(parents, sort)
  const limitedParents = limit === undefined ? sortedParents : sortedParents.slice(0, limit)
  return limitedParents.map((issue) => projectIssueRecord(issue, fields))
}

export async function issueSearch(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>[]> {
  const positional = args["_"]
  const positionalArgs = positional === undefined ? [] : Array.isArray(positional) ? positional : [positional]
  const queryFromPositional = positionalArgs.join(" ").trim()
  const queryFromFlag = optionalFlag(args, "--text")?.trim()
  const query = queryFromFlag && queryFromFlag.length > 0 ? queryFromFlag : queryFromPositional
  if (!query) {
    throw new Error("search query is required (pass positional text or --text)")
  }

  const nextArgs: Record<string, string | string[] | undefined> = { ...args, "--text": query }
  delete nextArgs._
  const searchResults = await searchTrackedIssues(root, "--all" in args, query)
  const filteredArgs: Record<string, string | string[] | undefined> = { ...nextArgs }
  delete filteredArgs["--text"]

  const fields = resolveOutputFields(filteredArgs, COMPACT_LIST_FIELDS, true)
  const limit = parseLimit(filteredArgs)
  const sort = parseSort(filteredArgs)
  const sortedResults = sortIssues(searchResults, sort)
  const limitedResults = limit === undefined ? sortedResults : sortedResults.slice(0, limit)
  return limitedResults.map((issue) => projectIssueRecord(issue, fields))
}

export async function issueRelated(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>[]> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  const targetId = basename(path)
  const includeAll = "--all" in args
  const fields = resolveOutputFields(args, COMPACT_RELATED_FIELDS, true)
  const limit = parseLimit(args)
  const sort = parseSort(args)
  const related = new Map<string, Record<string, unknown>>()

  for (const parentId of await listHierarchyParents(root, targetId)) {
    const parent = tryLoadIssueRecord(root, parentId)
    if (!parent) continue
    related.set(String(parent.id), { ...parent, relation: "parent" })
  }

  for (const childId of await listHierarchyChildren(root, targetId, includeAll)) {
    const child = tryLoadIssueRecord(root, childId)
    if (!child) continue

    const existing = related.get(String(child.id))
    if (existing) {
      related.set(String(child.id), { ...existing, relation: "both" })
    } else {
      related.set(String(child.id), { ...child, relation: "child" })
    }
  }

  const relatedIssues = sortIssues([...related.values()], sort)
  const limitedRelated = limit === undefined ? relatedIssues : relatedIssues.slice(0, limit)
  return limitedRelated.map((issue) => projectIssueRecord(issue, fields))
}

export async function issueClose(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>> {
  const id = requireFlag(args, "--id")
  const { path: issuePath, archived } = resolveIssue(id, root)

  if (archived) {
    return { already_closed: true }
  }

  const dirName = basename(issuePath)
  const archiveRoot = getArchiveRoot(root)
  const archivePath = join(archiveRoot, dirName)
  mkdirSync(archiveRoot, { recursive: true })
  renameSync(issuePath, archivePath)

  // Update status
  const jsonPath = join(archivePath, "issue.json")
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"))
  data.status = "closed"
  touchIssueMetadata(data)
  writeFileSync(jsonPath, JSON.stringify(data, null, 2))

  return { closed: true }
}

export async function issueMetaSet(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<Record<string, unknown>> {
  const id = requireFlag(args, "--id")
  const key = requireFlag(args, "--key")
  const value = requireFlag(args, "--value")
  const { path: issuePath } = resolveIssue(id, root)

  const jsonPath = join(issuePath, "issue.json")
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"))
  data[key] = value
  touchIssueMetadata(data)
  writeFileSync(jsonPath, JSON.stringify(data, null, 2))

  return data
}

export async function issueMetaGet(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<{ value: string | null }> {
  const id = requireFlag(args, "--id")
  const key = requireFlag(args, "--key")
  const { path: issuePath } = resolveIssue(id, root)

  const jsonPath = join(issuePath, "issue.json")
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"))
  const val = data[key]
  return { value: val !== undefined ? val : null }
}

// ---------------------------------------------------------------------------
// Array field update
// ---------------------------------------------------------------------------

export async function updateArrayField(
  args: Record<string, string | string[] | undefined>,
  field: string,
  root: string
): Promise<{ id: string; field: string; values: string[] }> {
  const id = requireFlag(args, "--id")
  const addRaw = args["--add"]
  const removeRaw = args["--remove"]

  if (addRaw === undefined && removeRaw === undefined) {
    throw new Error("At least one of --add or --remove is required")
  }

  const toAdd = addRaw ? (Array.isArray(addRaw) ? addRaw : [addRaw]) : []
  const toRemove = removeRaw ? (Array.isArray(removeRaw) ? removeRaw : [removeRaw]) : []

  const { path: issuePath } = resolveIssue(id, root)
  const jsonPath = join(issuePath, "issue.json")
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"))

  let values: string[] = Array.isArray(data[field]) ? data[field] : []

  // Remove first, then add
  const removeSet = new Set(toRemove)
  values = values.filter((v: string) => !removeSet.has(v))
  for (const v of toAdd) {
    if (!values.includes(v)) values.push(v)
  }

  data[field] = values
  touchIssueMetadata(data)
  writeFileSync(jsonPath, JSON.stringify(data, null, 2))

  return { id: basename(issuePath), field, values }
}

// ---------------------------------------------------------------------------
// Store commands
// ---------------------------------------------------------------------------

const SAFE_NAME_RE = /^[a-zA-Z0-9_.-]+$/

function validateStoreName(name: string): void {
  if (!SAFE_NAME_RE.test(name) || name.includes("..")) {
    throw new Error(`Invalid store name '${name}'`)
  }
}

function validateStoreKey(key: string): void {
  if (!SAFE_NAME_RE.test(key) || key.includes("..")) {
    throw new Error(`Invalid key '${key}'`)
  }
}

async function readAllStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  return Buffer.concat(chunks).toString()
}

export async function storeSet(
  args: Record<string, string | string[] | undefined>,
  readStdin: () => Promise<string>,
  root: string,
): Promise<{ stored: true }> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  const key = requireFlag(args, "--key")
  validateStoreName(store)
  validateStoreKey(key)

  const { path: issuePath } = resolveIssue(id, root)
  const storeDir = join(issuePath, store)
  mkdirSync(storeDir, { recursive: true })

  const valueFlag = args["--value"]
  const fileFlag = args["--file"]
  let content: string
  if (valueFlag !== undefined) {
    content = Array.isArray(valueFlag) ? valueFlag[0] : valueFlag
  } else if (fileFlag !== undefined) {
    const filePath = Array.isArray(fileFlag) ? fileFlag[0] : fileFlag
    content = readFileSync(filePath, "utf-8")
  } else {
    content = await readStdin()
  }
  writeFileSync(join(storeDir, key), content)

  const jsonPath = join(issuePath, "issue.json")
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"))
  touchIssueMetadata(data)
  writeFileSync(jsonPath, JSON.stringify(data, null, 2))

  return { stored: true }
}

export async function storeGet(
  args: Record<string, string | string[] | undefined>,
  root: string,
): Promise<{ value: string | null }> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  const key = requireFlag(args, "--key")
  validateStoreName(store)
  validateStoreKey(key)

  const { path: issuePath } = resolveIssue(id, root)
  const filePath = join(issuePath, store, key)

  if (!existsSync(filePath)) return { value: null }
  return { value: readFileSync(filePath, "utf-8") }
}

export async function storeKeys(
  args: Record<string, string | string[] | undefined>,
  root: string,
): Promise<{ keys: string[] }> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  validateStoreName(store)

  const { path: issuePath } = resolveIssue(id, root)
  const storeDir = join(issuePath, store)

  if (!existsSync(storeDir)) return { keys: [] }
  return { keys: readdirSync(storeDir).sort() }
}

export async function storeDelete(
  args: Record<string, string | string[] | undefined>,
  root: string,
): Promise<{ deleted: boolean; kind: "store" | "key"; removedEmptyStore?: boolean }> {
  const id = requireFlag(args, "--id")
  const store = requireFlag(args, "--store")
  const keyRaw = args["--key"]
  validateStoreName(store)

  const key = keyRaw !== undefined ? (Array.isArray(keyRaw) ? keyRaw[0] : keyRaw) : undefined
  if (key !== undefined) validateStoreKey(key)

  const { path: issuePath } = resolveIssue(id, root)
  const storeDir = join(issuePath, store)

  if (key === undefined) {
    if (!existsSync(storeDir)) return { deleted: false, kind: "store" }
    rmSync(storeDir, { recursive: true, force: true })
    const jsonPath = join(issuePath, "issue.json")
    const data = JSON.parse(readFileSync(jsonPath, "utf-8"))
    touchIssueMetadata(data)
    writeFileSync(jsonPath, JSON.stringify(data, null, 2))
    return { deleted: true, kind: "store" }
  }

  const keyPath = join(storeDir, key)
  if (!existsSync(keyPath)) return { deleted: false, kind: "key" }

  rmSync(keyPath, { force: true })

  const jsonPath = join(issuePath, "issue.json")
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"))
  touchIssueMetadata(data)
  writeFileSync(jsonPath, JSON.stringify(data, null, 2))

  if (existsSync(storeDir) && readdirSync(storeDir).length === 0) {
    rmSync(storeDir, { recursive: true, force: true })
    return { deleted: true, kind: "key", removedEmptyStore: true }
  }

  return { deleted: true, kind: "key" }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export const commands: Record<string, Command> = {
  create: {
    description: "Create a new issue",
    usage: "task create --title <title> [--description <desc>] [--github-issue <number>] [--priority <0-4>] [--label <label>] [--parent <id>]",
    flags: {
      "--title": { description: "Issue title", required: true },
      "--description": { description: "Issue description" },
      "--github-issue": { description: "GitHub issue number" },
      "--priority": { description: "Priority (0=highest, default 2)" },
      "--label": { description: "Label (repeatable)" },
      "--parent": { description: "Parent issue ID for hierarchy" },
    },
    examples: [
      'task create --title "Fix login bug"',
      'task create --title "Urgent fix" --priority 0',
      'task create --title "New feature" --github-issue 42',
      'task create --title "Fix PDF" --label cli --label bug',
      'task create --title "Add child command" --parent ab12',
    ],
    run: (args) => issueCreate(args, detectRepoRoot(process.cwd())),
  },
  show: {
    description: "Show issue details",
    usage: "task show <id> [--fields <csv>] [--compact] [--summary] [--include-stores]",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--fields": { description: "Comma-separated metadata fields to return" },
      "--compact": { description: "Return a compact metadata projection suitable for agents" },
      "--summary": { description: "Return metadata only (omit stores unless --include-stores is passed)" },
      "--include-stores": { description: "Include store names and keys in the output" },
    },
    examples: [
      "task show ab12",
      "task show ab12 --summary",
      "task show ab12 --compact",
      "task show ab12 --fields title,phase,refs",
      "task show --id ab12",
    ],
    positionalId: true,
    run: (args) => issueShow(args, detectRepoRoot(process.cwd())),
  },
  list: {
    description: "List issues",
    usage: "task list [--where key=value] [--label <label>] [--text <query>] [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--where": { description: "Filter by key=value (repeatable, AND logic)" },
      "--label": { description: "Filter by label (repeatable, AND logic)" },
      "--text": { description: "Case-insensitive text search across id, title, description, refs, and labels" },
      "--fields": { description: "Comma-separated fields to return for each issue" },
      "--compact": { description: "Return a compact issue projection suitable for agents (default)" },
      "--full": { description: "Return full issue objects instead of the default compact projection" },
      "--sort": { description: "Sort by priority (default) or updated" },
      "--limit": { description: "Maximum number of results to return" },
      "--jsonl": { description: "Format array output as one JSON object per line" },
      "--all": { description: "Include archived issues" },
    },
    examples: [
      "task list",
      "task list --where status=open",
      "task list --label cli",
      "task list --label cli --label bug",
      "task list --text \"packet session\"",
      "task list --sort updated",
      "task list --jsonl --all --limit 10",
      "task list --full --limit 1",
    ],
    run: (args) => issueList(args, detectRepoRoot(process.cwd())),
  },
  search: {
    description: "Search issues by text",
    usage: "task search <query> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--text": { description: "Optional explicit search query (otherwise uses positional query text)" },
      "--fields": { description: "Comma-separated fields to return for each issue" },
      "--compact": { description: "Return a compact issue projection suitable for agents (default)" },
      "--full": { description: "Return full issue objects instead of the default compact projection" },
      "--sort": { description: "Sort by priority (default) or updated" },
      "--limit": { description: "Maximum number of results to return" },
      "--jsonl": { description: "Format array output as one JSON object per line" },
      "--all": { description: "Include archived issues" },
    },
    examples: [
      "task search packet session",
      "task search \"new packet session page\" --sort updated",
      "task search --text \"packet session\" --jsonl",
    ],
    run: (args) => issueSearch(args, detectRepoRoot(process.cwd())),
  },
  children: {
    description: "List child issues in the hierarchy under a parent issue",
    usage: "task children <id> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--id": { description: "Parent issue ID (or pass as the first positional argument)" },
      "--fields": { description: "Comma-separated fields to return for each child issue" },
      "--compact": { description: "Return a compact issue projection suitable for agents (default)" },
      "--full": { description: "Return full issue objects instead of the default compact projection" },
      "--sort": { description: "Sort by priority (default) or updated" },
      "--limit": { description: "Maximum number of results to return" },
      "--jsonl": { description: "Format array output as one JSON object per line" },
      "--all": { description: "Include archived issues" },
    },
    examples: [
      "task children gh549",
      "task children gh549 --sort updated",
      "task children gh549 --fields id,title,phase,status",
      "task children gh549 --full",
      "task children --id gh549",
    ],
    positionalId: true,
    run: (args) => issueChildren(args, detectRepoRoot(process.cwd())),
  },
  parents: {
    description: "List parent issues for an issue in the hierarchy",
    usage: "task parents <id> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl]",
    flags: {
      "--id": { description: "Child issue ID (or pass as the first positional argument)" },
      "--fields": { description: "Comma-separated fields to return for each parent issue" },
      "--compact": { description: "Return a compact issue projection suitable for agents (default)" },
      "--full": { description: "Return full issue objects instead of the default compact projection" },
      "--sort": { description: "Sort by priority (default) or updated" },
      "--limit": { description: "Maximum number of results to return" },
      "--jsonl": { description: "Format array output as one JSON object per line" },
    },
    examples: [
      "task parents ojyb",
      "task parents ojyb --sort updated",
      "task parents ojyb --fields id,title,phase,status",
      "task parents ojyb --full",
      "task parents --id ojyb",
    ],
    positionalId: true,
    run: (args) => issueParents(args, detectRepoRoot(process.cwd())),
  },
  related: {
    description: "List parent and child issues related to an issue",
    usage: "task related <id> [--fields <csv>] [--compact|--full] [--sort priority|updated] [--limit <n>] [--jsonl] [--all]",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--fields": { description: "Comma-separated fields to return for each related issue" },
      "--compact": { description: "Return a compact relation projection suitable for agents (default)" },
      "--full": { description: "Return full issue objects instead of the default compact projection" },
      "--sort": { description: "Sort by priority (default) or updated" },
      "--limit": { description: "Maximum number of results to return" },
      "--jsonl": { description: "Format array output as one JSON object per line" },
      "--all": { description: "Include archived child issues in the results" },
    },
    examples: [
      "task related gh549",
      "task related gh549 --sort updated",
      "task related gh549 --fields id,title,relation,status",
      "task related gh549 --full",
      "task related --id gh549",
    ],
    positionalId: true,
    run: (args) => issueRelated(args, detectRepoRoot(process.cwd())),
  },
  close: {
    description: "Close an issue (move to archive)",
    usage: "task close <id>",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
    },
    examples: ["task close ab12", "task close --id ab12"],
    positionalId: true,
    run: (args) => issueClose(args, detectRepoRoot(process.cwd())),
  },
  "meta set": {
    description: "Set a metadata field on an issue",
    usage: "task meta set <id> --key <key> --value <value>",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--key": { description: "Metadata key", required: true },
      "--value": { description: "Metadata value", required: true },
    },
    examples: [
      "task meta set 0ov2 --key phase --value ready-to-code",
      "task meta set --id 0ov2 --key phase --value ready-to-code",
    ],
    positionalId: true,
    run: (args) => issueMetaSet(args, detectRepoRoot(process.cwd())),
  },
  "meta get": {
    description: "Get a metadata field from an issue",
    usage: "task meta get <id> --key <key>",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--key": { description: "Metadata key", required: true },
    },
    examples: ["task meta get 0ov2 --key phase", "task meta get --id 0ov2 --key phase"],
    positionalId: true,
    run: (args) => issueMetaGet(args, detectRepoRoot(process.cwd())),
  },
  "update label": {
    description: "Add or remove labels on an issue",
    usage: "task update label <id> [--add <label>] [--remove <label>]",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--add": { description: "Label to add (repeatable)" },
      "--remove": { description: "Label to remove (repeatable)" },
    },
    examples: [
      "task update label ab12 --add cli",
      "task update label ab12 --add cli --add bug",
      "task update label ab12 --remove cli",
      "task update label ab12 --remove old --add new",
      "task update label --id ab12 --add cli",
    ],
    positionalId: true,
    run: (args) => updateArrayField(args, "labels", detectRepoRoot(process.cwd())),
  },
  "update refs": {
    description: "Add or remove refs on an issue",
    usage: "task update refs <id> [--add <ref>] [--remove <ref>]",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--add": { description: "Ref to add (repeatable)" },
      "--remove": { description: "Ref to remove (repeatable)" },
    },
    examples: [
      "task update refs ab12 --add m85s",
      "task update refs ab12 --remove m85s",
      "task update refs --id ab12 --add m85s",
    ],
    positionalId: true,
    run: (args) => updateArrayField(args, "refs", detectRepoRoot(process.cwd())),
  },
  "store set": {
    description: "Store a value (from --value, --file, or stdin)",
    usage:
      "task store set <id> --store <store> --key <key> [--value <val> | --file <path>]",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--store": { description: "Store name", required: true },
      "--key": { description: "Key name", required: true },
      "--value": { description: "Value to store (for simple strings)" },
      "--file": { description: "Read value from file path (for multiline content)" },
    },
    examples: [
      'task store set ab12 --store research --key summary --value "quick note"',
      "task store set ab12 --store research --key details --file /tmp/details.md",
      "echo 'content' | task store set ab12 --store research --key summary",
      'task store set --id ab12 --store research --key summary --value "quick note"',
    ],
    positionalId: true,
    run: (args) => storeSet(args, readAllStdin, detectRepoRoot(process.cwd())),
  },
  "store get": {
    description: "Get a stored value",
    usage: "task store get <id> --store <store> --key <key>",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--store": { description: "Store name", required: true },
      "--key": { description: "Key name", required: true },
    },
    examples: [
      "task store get ab12 --store research --key summary",
      "task store get --id ab12 --store research --key summary",
    ],
    positionalId: true,
    run: (args) => storeGet(args, detectRepoRoot(process.cwd())),
  },
  "store keys": {
    description: "List keys in a store",
    usage: "task store keys <id> --store <store>",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--store": { description: "Store name", required: true },
    },
    examples: ["task store keys ab12 --store research", "task store keys --id ab12 --store research"],
    positionalId: true,
    run: (args) => storeKeys(args, detectRepoRoot(process.cwd())),
  },
  "store delete": {
    description: "Delete a key from a store, or delete the entire store if --key is omitted",
    usage: "task store delete <id> --store <store> [--key <key>]",
    flags: {
      "--id": { description: "Issue ID (or pass as the first positional argument)" },
      "--store": { description: "Store name", required: true },
      "--key": { description: "Key name (omit to delete the whole store)" },
    },
    examples: [
      "task store delete ab12 --store research --key summary",
      "task store delete ab12 --store research",
      "task store delete --id ab12 --store research --key summary",
    ],
    positionalId: true,
    run: (args) => storeDelete(args, detectRepoRoot(process.cwd())),
  },
}
