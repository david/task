import { existsSync, readdirSync, statSync } from "node:fs"
import { basename, join } from "node:path"
import type { CommandArgs, CommandFlag, FlagValue, JsonObject, JsonValue, StringMap } from "./types"
import type { IssueMetadata, IssueRecord } from "./tracker/events"
import { getArchiveRoot, getIssueRoot, listCanonicalIssueIds } from "./tracker/root"
import { loadArchivedTrackedIssue, loadTrackedIssue } from "./tracker/issues"

function listDirsWithPrefix(dir: string, prefix: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(
    (entry) => entry.startsWith(`${prefix}-`) && statSync(join(dir, entry)).isDirectory()
  )
}

function issueIdPrefix(issueId: string): string {
  const prefix = issueId.split("-", 1)[0]
  if (prefix === undefined || prefix.length === 0) {
    throw new Error(`Invalid issue ID '${issueId}'`)
  }
  return prefix
}

export const COMPACT_LIST_FIELDS = ["id", "title", "status", "phase", "priority", "refs"] as const
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
] as const
export const COMPACT_RELATED_FIELDS = ["id", "title", "status", "phase", "priority", "relation"] as const

export type SortMode = "priority" | "updated"
export type IssueProjection = Partial<IssueRecord> & { id: string }
export type ProjectedIssueMetadata = JsonObject
export type IssueProjectionOutput = JsonObject
export type IssueRelation = "parent" | "child" | "both"
export type RelatedIssueProjection = IssueProjection & { relation: IssueRelation }
export type RelatedIssueProjectionOutput = JsonObject
export type IssueShowResult =
  | { id: string; metadata: ProjectedIssueMetadata }
  | { id: string; metadata: ProjectedIssueMetadata; stores: StringMap<string[]> }
export type IssueCloseResult = { closed: true } | { already_closed: true }
export type MetadataLookupValue = Exclude<IssueMetadata[string], undefined> | null
export type IssueMetaGetResult = { value: MetadataLookupValue }
export type StoreValue = string | null
export type StoreLookupResult = { value: StoreValue }
export type StoreDeleteResult =
  | { deleted: false; kind: "store" }
  | { deleted: true; kind: "store" }
  | { deleted: false; kind: "key" }
  | { deleted: true; kind: "key" }
  | { deleted: true; kind: "key"; removedEmptyStore: true }

function getFlagValue(args: CommandArgs, flag: CommandFlag): FlagValue | undefined {
  return args[flag]
}

function firstValue(value: FlagValue): string {
  return Array.isArray(value) ? value[0] : value
}

export function requireFlag(args: CommandArgs, flag: CommandFlag): string {
  const value = getFlagValue(args, flag)
  if (value === undefined) {
    throw new Error(`${flag} is required`)
  }
  return firstValue(value)
}

export function resolveIssue(
  id: string,
  root: string
): { path: string; archived: boolean } {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Invalid issue ID '${id}': must be lowercase alphanumeric (with optional slug)`)
  }

  const prefix = issueIdPrefix(id)
  const issueRoot = getIssueRoot(root)
  const archiveDir = getArchiveRoot(root)

  const currentIds = new Set<string>(listDirsWithPrefix(issueRoot, prefix))
  for (const issueId of listCanonicalIssueIds(root)) {
    if (issueId.startsWith(`${prefix}-`)) {
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
  const allMatches = [...currentMatches, ...archiveMatches]

  if (allMatches.length === 0) {
    throw new Error(`Issue '${id}' not found`)
  }
  if (allMatches.length > 1) {
    const list = allMatches.map((match) => basename(match.path)).join(", ")
    throw new Error(`Ambiguous ID '${id}': ${list}`)
  }

  const match = allMatches[0]
  if (match === undefined) {
    throw new Error(`Issue '${id}' not found`)
  }
  return match
}

export function optionalFlag(args: CommandArgs, flag: CommandFlag): string | undefined {
  const value = getFlagValue(args, flag)
  return value === undefined ? undefined : firstValue(value)
}

export function parseCsvFlag(args: CommandArgs, flag: CommandFlag): string[] | undefined {
  const raw = getFlagValue(args, flag)
  if (raw === undefined) {
    return undefined
  }

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
  if (raw === undefined) {
    return undefined
  }

  const limit = Number(raw)
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("--limit must be a positive integer")
  }
  return limit
}

export function parseSort(args: CommandArgs): SortMode {
  const raw = optionalFlag(args, "--sort")
  if (raw === undefined) {
    return "priority"
  }
  if (raw === "priority" || raw === "updated") {
    return raw
  }
  throw new Error("--sort must be one of: priority, updated")
}

export function resolveOutputFields(
  args: CommandArgs,
  compactFields: readonly string[],
  defaultCompact = false
): string[] | undefined {
  const explicitFields = parseCsvFlag(args, "--fields")
  if (explicitFields !== undefined) return explicitFields
  if (args["--full"] !== undefined) return undefined
  if (args["--compact"] !== undefined || defaultCompact) return [...compactFields]
  return undefined
}

export function isJsonValue(value: JsonValue | undefined): value is JsonValue {
  return value !== undefined
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

export function sortIssues<T extends IssueProjection>(issues: readonly T[], sort: SortMode): T[] {
  return [...issues].sort((a, b) => {
    if (sort === "updated") {
      const ua = typeof a.updated === "string" ? a.updated : ""
      const ub = typeof b.updated === "string" ? b.updated : ""
      if (ua === ub) {
        return a.id.localeCompare(b.id)
      }
      return ub.localeCompare(ua)
    }

    const pa = typeof a.priority === "number" ? a.priority : Number.POSITIVE_INFINITY
    const pb = typeof b.priority === "number" ? b.priority : Number.POSITIVE_INFINITY
    if (pa !== pb) return pa - pb
    return a.id.localeCompare(b.id)
  })
}

export function matchesText(issue: IssueProjection, query: string): boolean {
  const haystacks: string[] = []
  const stringFields = [issue.id, issue.title, issue.description]
  for (const value of stringFields) {
    if (typeof value === "string") {
      haystacks.push(value)
    }
  }

  const listFields = [issue.refs, issue.labels]
  for (const value of listFields) {
    if (!Array.isArray(value)) {
      continue
    }
    for (const item of value) {
      if (typeof item === "string") {
        haystacks.push(item)
      }
    }
  }

  const normalized = query.toLowerCase()
  return haystacks.some((value) => value.toLowerCase().includes(normalized))
}

export function projectIssueRecord(issue: IssueProjection, fields: string[] | undefined): IssueProjectionOutput {
  return pickFields(issue, fields)
}

export function projectRelatedIssueRecord(
  issue: RelatedIssueProjection,
  fields: string[] | undefined
): RelatedIssueProjectionOutput {
  return pickFields(issue, fields)
}
