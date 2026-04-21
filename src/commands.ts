import { basename } from "node:path"
import type { CommandArgs } from "./types"
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
