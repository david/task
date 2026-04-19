import { existsSync, readdirSync, statSync } from "node:fs"
import { basename, join } from "node:path"
import type { CommandArgs, JsonObject, JsonValue, StringMap } from "./types"
import type { IssueMetadata, IssueRecord } from "./tracker/events"
import { getArchiveRoot, getIssueRoot, listCanonicalIssueIds } from "./tracker/root"
import { loadArchivedTrackedIssue, loadTrackedIssue } from "./tracker/issues"

function listDirsWithPrefix(dir: string, prefix: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(
    (entry) => entry.startsWith(prefix + "-") && statSync(join(dir, entry)).isDirectory()
  )
}

export const COMPACT_LIST_FIELDS = ["id", "title", "status", "phase", "priority", "refs"]
export const COMPACT_SHOW_FIELDS = [
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
export const COMPACT_RELATED_FIELDS = ["id", "title", "status", "phase", "priority", "relation"]

export type SortMode = "priority" | "updated"
export type IssueProjection = Partial<IssueRecord> & { id: string }
export type IssueRelation = "parent" | "child" | "both"
export type RelatedIssueProjection = IssueProjection & { relation: IssueRelation }
export type IssueShowResult =
  | { id: string; metadata: JsonObject }
  | { id: string; metadata: JsonObject; stores: StringMap<string[]> }
export type IssueCloseResult = { closed: true } | { already_closed: true }
export type MetadataLookupValue = IssueMetadata[string] | null
export type IssueMetaGetResult = { value: MetadataLookupValue }
export type StoreValue = string | null
export type StoreLookupResult = { value: StoreValue }
export type StoreDeleteResult =
  | { deleted: false; kind: "store" }
  | { deleted: true; kind: "store" }
  | { deleted: false; kind: "key" }
  | { deleted: true; kind: "key" }
  | { deleted: true; kind: "key"; removedEmptyStore: true }

export function requireFlag(args: CommandArgs, flag: string): string {
  const val = args[flag]
  if (val === undefined) throw new Error(`${flag} is required`)
  return Array.isArray(val) ? val[0] : val
}

export function resolveIssue(
  id: string,
  root: string
): { path: string; archived: boolean } {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid issue ID '${id}': must be lowercase alphanumeric (with optional slug)`)
  }

  const prefix = id.split("-")[0]
  const issueRoot = getIssueRoot(root)
  const archiveDir = getArchiveRoot(root)

  const currentIds = new Set<string>(listDirsWithPrefix(issueRoot, prefix))
  for (const issueId of listCanonicalIssueIds(root)) {
    if (issueId.startsWith(prefix + "-")) {
      currentIds.add(issueId)
    }
  }

  const archivedIds = new Set(
    listDirsWithPrefix(archiveDir, prefix).filter((issueId) => !currentIds.has(issueId))
  )

  const currentMatches = [...currentIds].sort().map((issueId) => ({
    path: join(issueRoot, issueId),
    archived: false,
  }))
  const archiveMatches = [...archivedIds].sort().map((issueId) => ({
    path: join(archiveDir, issueId),
    archived: true,
  }))
  const all = [...currentMatches, ...archiveMatches]

  if (all.length === 0) {
    throw new Error(`Issue '${id}' not found`)
  }
  if (all.length > 1) {
    const list = all.map((match) => basename(match.path)).join(", ")
    throw new Error(`Ambiguous ID '${id}': ${list}`)
  }
  return all[0]
}

export function optionalFlag(args: CommandArgs, flag: string): string | undefined {
  const val = args[flag]
  if (val === undefined) return undefined
  return Array.isArray(val) ? val[0] : val
}

export function parseCsvFlag(args: CommandArgs, flag: string): string[] | undefined {
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

export function parseLimit(args: CommandArgs): number | undefined {
  const raw = optionalFlag(args, "--limit")
  if (raw === undefined) return undefined
  const limit = Number(raw)
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer")
  }
  return limit
}

export function parseSort(args: CommandArgs): SortMode {
  const raw = optionalFlag(args, "--sort")
  if (raw === undefined) return "priority"
  if (raw === "priority" || raw === "updated") return raw
  throw new Error("--sort must be one of: priority, updated")
}

export function resolveOutputFields(
  args: CommandArgs,
  compactFields: string[],
  defaultCompact = false
): string[] | undefined {
  const explicitFields = parseCsvFlag(args, "--fields")
  if (explicitFields !== undefined) return explicitFields
  if ("--full" in args) return undefined
  if ("--compact" in args || defaultCompact) return compactFields
  return undefined
}

export function isJsonValue(value: JsonValue | object | null | undefined): value is JsonValue {
  if (value === null) return true
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item))
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).every((item) => isJsonValue(item))
  }
  return false
}

export function pickFields(
  source: StringMap<JsonValue | undefined>,
  fields: string[] | undefined
): JsonObject {
  const picked: JsonObject = {}
  const entries: Array<[string, JsonValue | undefined]> = fields === undefined
    ? Object.entries(source)
    : fields.map((field): [string, JsonValue | undefined] => [field, source[field]])

  for (const [field, value] of entries) {
    if (isJsonValue(value)) {
      picked[field] = value
    }
  }

  return picked
}

export async function loadIssueRecord(root: string, issueId: string): Promise<IssueRecord | null> {
  try {
    const resolved = resolveIssue(issueId, root)
    const issue = resolved.archived
      ? loadArchivedTrackedIssue(root, basename(resolved.path))
      : await loadTrackedIssue(root, basename(resolved.path))
    return { id: issue.id, ...issue.metadata }
  } catch {
    return null
  }
}

export function sortIssues(issues: IssueProjection[], sort: SortMode): IssueProjection[] {
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

export function matchesText(issue: IssueProjection, query: string): boolean {
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

export function projectIssueRecord(issue: IssueProjection, fields: string[] | undefined): JsonObject {
  return pickFields(issue, fields)
}
