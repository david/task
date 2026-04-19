import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import {
  foldIssueState,
  issueBoundaryTag,
  parseIssueCreatedPayload,
  storedEventSchema,
  type IssueRecord,
  type IssueState,
  type TrackerStoredEvent,
} from "./events"
import type { JsonObject, JsonValue, StringMap } from "../types"
import { getTrackerHandles, listCanonicalIssueIds } from "./root"
import { getVisibleStores, materializeVisibleStores } from "./stores"

type QueryStoredEventsByTags = <TState>(
  tags: ReadonlyArray<string>,
  schemas: ReadonlyArray<typeof storedEventSchema>,
  fold: (events: ReadonlyArray<TrackerStoredEvent>) => TState
) => Promise<{ state: TState; maxPosition: bigint | undefined }>

export type IssueAggregate = {
  state: IssueState
  maxPosition: bigint | undefined
}

export type HierarchyIndex = {
  parentsByChild: StringMap<string[]>
  childrenByParent: StringMap<string[]>
}

function createEmptyHierarchyIndex(): HierarchyIndex {
  return {
    parentsByChild: {},
    childrenByParent: {},
  }
}

function issueIndexPath(root: string): string {
  return join(getTrackerHandles(root).trackerRoot, "indexes", "issues", "current.json")
}

function hierarchyIndexDir(root: string): string {
  return join(getTrackerHandles(root).trackerRoot, "indexes", "hierarchy")
}

function hierarchyIndexPaths(root: string): { parentsPath: string; childrenPath: string } {
  const dir = hierarchyIndexDir(root)
  return {
    parentsPath: join(dir, "parents-by-child.json"),
    childrenPath: join(dir, "children-by-parent.json"),
  }
}

function addHierarchyLink(index: HierarchyIndex, childId: string, parentId: string): void {
  const parents = index.parentsByChild[childId] ?? []
  if (!parents.includes(parentId)) {
    parents.push(parentId)
    parents.sort()
    index.parentsByChild[childId] = parents
  }

  const children = index.childrenByParent[parentId] ?? []
  if (!children.includes(childId)) {
    children.push(childId)
    children.sort()
    index.childrenByParent[parentId] = children
  }
}

function foldHierarchyIndex(events: ReadonlyArray<TrackerStoredEvent>): HierarchyIndex {
  const index = createEmptyHierarchyIndex()

  for (const event of events) {
    if (event.type !== "IssueCreated") {
      continue
    }

    const payload = parseIssueCreatedPayload(event.payload)
    if (!payload?.parentId) {
      continue
    }

    addHierarchyLink(index, payload.issueId, payload.parentId)
  }

  return index
}

function queryStoredEventsByTags<TState>(
  root: string,
  tags: ReadonlyArray<string>,
  fold: (events: ReadonlyArray<TrackerStoredEvent>) => TState
): Promise<{ state: TState; maxPosition: bigint | undefined }> {
  const queryByTags = getTrackerHandles(root).eventStore.queryByTags as QueryStoredEventsByTags
  return queryByTags(tags, [storedEventSchema], fold)
}

export async function readTrackedIssueAggregate(
  root: string,
  issueId: string
): Promise<IssueAggregate> {
  const result = await queryStoredEventsByTags(root, [issueBoundaryTag(issueId)], (events) =>
    foldIssueState(events)
  )

  if (result.state === undefined) {
    throw new Error(`Issue '${issueId}' not found`)
  }

  return {
    state: result.state,
    maxPosition: result.maxPosition,
  }
}

function materializeIssueProjection(root: string, issueId: string, aggregate: IssueAggregate): void {
  const tracker = getTrackerHandles(root)
  const issueDir = join(tracker.issueRoot, issueId)
  mkdirSync(issueDir, { recursive: true })
  writeFileSync(join(issueDir, "issue.json"), `${JSON.stringify(aggregate.state.metadata, null, 2)}\n`)
  materializeVisibleStores(issueDir, getVisibleStores(aggregate.state.stores))

  const legacyArchiveDir = join(tracker.archiveRoot, issueId)
  if (existsSync(legacyArchiveDir)) {
    rmSync(legacyArchiveDir, { recursive: true, force: true })
  }
}

export async function rebuildIssueProjection(
  root: string,
  issueId: string
): Promise<IssueAggregate | undefined> {
  try {
    const aggregate = await readTrackedIssueAggregate(root, issueId)
    materializeIssueProjection(root, issueId, aggregate)
    return aggregate
  } catch (error) {
    if (error instanceof Error && error.message === `Issue '${issueId}' not found`) {
      return undefined
    }
    throw error
  }
}

export async function rebuildCurrentIssueIndex(root: string): Promise<IssueRecord[]> {
  const issues: IssueRecord[] = []

  for (const issueId of listCanonicalIssueIds(root)) {
    const aggregate = await rebuildIssueProjection(root, issueId)
    if (aggregate === undefined) {
      continue
    }
    issues.push({ id: issueId, ...aggregate.state.metadata })
  }

  issues.sort((a, b) => a.id.localeCompare(b.id))

  const path = issueIndexPath(root)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(issues, null, 2)}\n`)
  return issues
}

export async function rebuildHierarchyIndex(root: string): Promise<HierarchyIndex> {
  const result = await queryStoredEventsByTags(root, ["kind:issue"], (events) =>
    foldHierarchyIndex(events)
  )

  const { parentsPath, childrenPath } = hierarchyIndexPaths(root)
  mkdirSync(hierarchyIndexDir(root), { recursive: true })
  writeFileSync(parentsPath, `${JSON.stringify(result.state.parentsByChild, null, 2)}\n`)
  writeFileSync(childrenPath, `${JSON.stringify(result.state.childrenByParent, null, 2)}\n`)
  return result.state
}

function isRecord(value: JsonValue | object | null): value is JsonObject {
  return typeof value === "object" && value !== null
}

function isStringArray(value: JsonValue | object | null): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

export function readLegacyIssueRecord(issueDir: string, issueId: string): IssueRecord | undefined {
  const issuePath = join(issueDir, "issue.json")
  if (!existsSync(issuePath)) {
    return undefined
  }

  try {
    const raw = JSON.parse(readFileSync(issuePath, "utf-8"))
    if (!isRecord(raw)) {
      return undefined
    }
    if (
      typeof raw.title !== "string" ||
      (raw.status !== "open" && raw.status !== "closed") ||
      typeof raw.phase !== "string"
    ) {
      return undefined
    }

    const description = typeof raw.description === "string" ? raw.description : ""
    const refs = isStringArray(raw.refs) ? [...raw.refs] : []
    const labels = isStringArray(raw.labels) ? [...raw.labels] : []
    const priority = typeof raw.priority === "number" ? raw.priority : Number.POSITIVE_INFINITY
    const created = typeof raw.created === "string" ? raw.created : ""
    const updated = typeof raw.updated === "string" ? raw.updated : ""

    const extras: JsonObject = {}
    for (const [key, value] of Object.entries(raw)) {
      if (
        key !== "title" &&
        key !== "description" &&
        key !== "status" &&
        key !== "phase" &&
        key !== "priority" &&
        key !== "created" &&
        key !== "updated" &&
        key !== "refs" &&
        key !== "labels"
      ) {
        extras[key] = value
      }
    }

    return {
      id: issueId,
      ...extras,
      title: raw.title,
      description,
      status: raw.status,
      phase: raw.phase,
      priority,
      created,
      updated,
      refs,
      labels,
    }
  } catch {
    return undefined
  }
}

export function readIssueStoreKeys(issueDir: string): StringMap<string[]> {
  const stores: StringMap<string[]> = {}
  if (!existsSync(issueDir)) {
    return stores
  }

  for (const entry of readdirSync(issueDir)) {
    if (entry === "issue.json") {
      continue
    }
    const entryPath = join(issueDir, entry)
    if (statSync(entryPath).isDirectory()) {
      stores[entry] = readdirSync(entryPath).sort()
    }
  }

  return stores
}
