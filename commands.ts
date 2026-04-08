import { randomBytes } from "node:crypto"
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  renameSync,
  statSync,
  existsSync,
} from "node:fs"
import { join, basename } from "node:path"
import { homedir } from "node:os"
import type { Command } from "./types"

const ISSUE_ROOT = join(homedir(), ".local", "share", "issues")

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

function generateId(root: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = randomBytes(4)
    let id = ""
    for (let i = 0; i < 4; i++) {
      id += chars[bytes[i] % chars.length]
    }
    // Check uniqueness in both active and archive
    const activeMatches = listDirsWithPrefix(root, id)
    const archiveMatches = listDirsWithPrefix(join(root, ".archive"), id)
    if (activeMatches.length === 0 && archiveMatches.length === 0) {
      return id
    }
  }
  throw new Error("Failed to generate unique ID after 100 attempts")
}

function listDirsWithPrefix(dir: string, prefix: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(
    (entry) => entry.startsWith(prefix + "-") && statSync(join(dir, entry)).isDirectory()
  )
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export function resolveIssue(
  id: string,
  root: string
): { path: string; archived: boolean } {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid issue ID '${id}': must be lowercase alphanumeric (with optional slug)`)
  }

  // Extract the short prefix (everything before the first hyphen) for matching
  const prefix = id.split("-")[0]

  const activeMatches = listDirsWithPrefix(root, prefix).map((d) => ({
    path: join(root, d),
    archived: false,
  }))
  const archiveDir = join(root, ".archive")
  const archiveMatches = listDirsWithPrefix(archiveDir, prefix).map((d) => ({
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

  // Ensure dirs exist
  mkdirSync(root, { recursive: true })
  mkdirSync(join(root, ".archive"), { recursive: true })

  const id = generateId(root)
  const slug = slugify(title)
  const dirName = `${id}-${slug}`
  const dirPath = join(root, dirName)
  mkdirSync(dirPath, { recursive: true })

  const priorityRaw = args["--priority"]
    ? (Array.isArray(args["--priority"]) ? args["--priority"][0] : args["--priority"])
    : undefined
  const priority = priorityRaw !== undefined ? Number(priorityRaw) : 2

  const labelRaw = args["--label"]
  const labels: string[] = labelRaw
    ? (Array.isArray(labelRaw) ? labelRaw : [labelRaw])
    : []

  const metadata: Record<string, unknown> = {
    title,
    description,
    status: "open",
    phase: "research",
    priority,
    created: new Date().toISOString().slice(0, 10),
    refs: [],
    labels,
  }
  if (githubIssueRaw !== undefined) {
    metadata.github_issue = Number(githubIssueRaw)
  }

  writeFileSync(join(dirPath, "issue.json"), JSON.stringify(metadata, null, 2))

  return { id: dirName, ...metadata }
}

export async function issueShow(
  args: Record<string, string | string[] | undefined>,
  root: string
): Promise<{ id: string; metadata: Record<string, unknown>; stores: Record<string, string[]> }> {
  const id = requireFlag(args, "--id")
  const { path } = resolveIssue(id, root)
  const slug = basename(path)

  const metadata = JSON.parse(readFileSync(join(path, "issue.json"), "utf-8"))

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

  return { id: slug, metadata, stores }
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

  const results: Record<string, unknown>[] = []

  const readIssuesFrom = (dir: string) => {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(".")) continue
      const entryPath = join(dir, entry)
      const jsonPath = join(entryPath, "issue.json")
      if (!existsSync(jsonPath)) continue
      if (!statSync(entryPath).isDirectory()) continue

      const data = JSON.parse(readFileSync(jsonPath, "utf-8"))

      // Apply where conditions
      let matches = true
      for (const [key, value] of conditions) {
        if (String(data[key]) !== value) {
          matches = false
          break
        }
      }
      // Apply label filters (AND logic — must have all specified labels)
      if (matches && labelFilters.length > 0) {
        const issueLabels: string[] = Array.isArray(data.labels) ? data.labels : []
        for (const lbl of labelFilters) {
          if (!issueLabels.includes(lbl)) {
            matches = false
            break
          }
        }
      }
      if (matches) {
        results.push({ id: entry, ...data })
      }
    }
  }

  readIssuesFrom(root)
  if (includeAll) {
    readIssuesFrom(join(root, ".archive"))
  }

  results.sort((a, b) => {
    const pa = typeof a.priority === "number" ? a.priority : Infinity
    const pb = typeof b.priority === "number" ? b.priority : Infinity
    return pa - pb
  })

  return results
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
  const archivePath = join(root, ".archive", dirName)
  mkdirSync(join(root, ".archive"), { recursive: true })
  renameSync(issuePath, archivePath)

  // Update status
  const jsonPath = join(archivePath, "issue.json")
  const data = JSON.parse(readFileSync(jsonPath, "utf-8"))
  data.status = "closed"
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

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export const commands: Record<string, Command> = {
  create: {
    description: "Create a new issue",
    usage: "task create --title <title> [--description <desc>] [--github-issue <number>] [--priority <0-4>] [--label <label>]",
    flags: {
      "--title": { description: "Issue title", required: true },
      "--description": { description: "Issue description" },
      "--github-issue": { description: "GitHub issue number" },
      "--priority": { description: "Priority (0=highest, default 2)" },
      "--label": { description: "Label (repeatable)" },
    },
    examples: [
      'task create --title "Fix login bug"',
      'task create --title "Urgent fix" --priority 0',
      'task create --title "New feature" --github-issue 42',
      'task create --title "Fix PDF" --label cli --label bug',
    ],
    run: (args) => issueCreate(args, ISSUE_ROOT),
  },
  show: {
    description: "Show issue details",
    usage: "task show --id <id>",
    flags: {
      "--id": { description: "Issue ID", required: true },
    },
    examples: ["task show --id ab12"],
    run: (args) => issueShow(args, ISSUE_ROOT),
  },
  list: {
    description: "List issues",
    usage: "task list [--where key=value] [--label <label>] [--all]",
    flags: {
      "--where": { description: "Filter by key=value (repeatable, AND logic)" },
      "--label": { description: "Filter by label (repeatable, AND logic)" },
      "--all": { description: "Include archived issues" },
    },
    examples: [
      "task list",
      "task list --where status=open",
      "task list --label cli",
      "task list --label cli --label bug",
      "task list --all",
    ],
    run: (args) => issueList(args, ISSUE_ROOT),
  },
  close: {
    description: "Close an issue (move to archive)",
    usage: "task close --id <id>",
    flags: {
      "--id": { description: "Issue ID", required: true },
    },
    examples: ["task close --id ab12"],
    run: (args) => issueClose(args, ISSUE_ROOT),
  },
  "meta set": {
    description: "Set a metadata field on an issue",
    usage: "task meta set --id <id> --key <key> --value <value>",
    flags: {
      "--id": { description: "Issue ID", required: true },
      "--key": { description: "Metadata key", required: true },
      "--value": { description: "Metadata value", required: true },
    },
    examples: ["task meta set --id 0ov2 --key phase --value architect"],
    run: (args) => issueMetaSet(args, ISSUE_ROOT),
  },
  "meta get": {
    description: "Get a metadata field from an issue",
    usage: "task meta get --id <id> --key <key>",
    flags: {
      "--id": { description: "Issue ID", required: true },
      "--key": { description: "Metadata key", required: true },
    },
    examples: ["task meta get --id 0ov2 --key phase"],
    run: (args) => issueMetaGet(args, ISSUE_ROOT),
  },
  "update label": {
    description: "Add or remove labels on an issue",
    usage: "task update label --id <id> [--add <label>] [--remove <label>]",
    flags: {
      "--id": { description: "Issue ID", required: true },
      "--add": { description: "Label to add (repeatable)" },
      "--remove": { description: "Label to remove (repeatable)" },
    },
    examples: [
      "task update label --id ab12 --add cli",
      "task update label --id ab12 --add cli --add bug",
      "task update label --id ab12 --remove cli",
      "task update label --id ab12 --remove old --add new",
    ],
    run: (args) => updateArrayField(args, "labels", ISSUE_ROOT),
  },
  "update refs": {
    description: "Add or remove refs on an issue",
    usage: "task update refs --id <id> [--add <ref>] [--remove <ref>]",
    flags: {
      "--id": { description: "Issue ID", required: true },
      "--add": { description: "Ref to add (repeatable)" },
      "--remove": { description: "Ref to remove (repeatable)" },
    },
    examples: [
      "task update refs --id ab12 --add m85s",
      "task update refs --id ab12 --remove m85s",
    ],
    run: (args) => updateArrayField(args, "refs", ISSUE_ROOT),
  },
  "store set": {
    description: "Store a value (from --value, --file, or stdin)",
    usage:
      "task store set --id <id> --store <store> --key <key> [--value <val> | --file <path>]",
    flags: {
      "--id": { description: "Issue ID", required: true },
      "--store": { description: "Store name", required: true },
      "--key": { description: "Key name", required: true },
      "--value": { description: "Value to store (for simple strings)" },
      "--file": { description: "Read value from file path (for multiline content)" },
    },
    examples: [
      'task store set --id ab12 --store research --key summary --value "quick note"',
      "task store set --id ab12 --store research --key details --file /tmp/details.md",
      "echo 'content' | task store set --id ab12 --store research --key summary",
    ],
    run: (args) => storeSet(args, readAllStdin, ISSUE_ROOT),
  },
  "store get": {
    description: "Get a stored value",
    usage: "task store get --id <id> --store <store> --key <key>",
    flags: {
      "--id": { description: "Issue ID", required: true },
      "--store": { description: "Store name", required: true },
      "--key": { description: "Key name", required: true },
    },
    examples: [
      "task store get --id ab12 --store research --key summary",
    ],
    run: (args) => storeGet(args, ISSUE_ROOT),
  },
  "store keys": {
    description: "List keys in a store",
    usage: "task store keys --id <id> --store <store>",
    flags: {
      "--id": { description: "Issue ID", required: true },
      "--store": { description: "Store name", required: true },
    },
    examples: ["task store keys --id ab12 --store research"],
    run: (args) => storeKeys(args, ISSUE_ROOT),
  },
}
