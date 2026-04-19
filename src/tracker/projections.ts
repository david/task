import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { EventId } from "../../packages/esther/src/index.ts"
import { readJsonFile } from "../infrastructure/json"
import type { JsonObject, JsonValue, StringMap } from "../types"
import {
  foldIssueState,
  type IssueRecord,
  type IssueState,
  type LegacyIssueFile,
  type StoredEventFile,
  type TrackerStoredEvent,
} from "./events"
import { legacyIssueFileSchema, parseIssueCreatedPayload, storedEventFileSchema } from "./events"
import { getTrackerHandles, listCanonicalIssueIds } from "./root"
import { getVisibleStores, materializeVisibleStores } from "./stores"

type MaxPosition = bigint | undefined

export type IssueAggregate = {
  state: IssueState
  maxPosition: MaxPosition
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
    const parentId = payload === undefined ? undefined : optionalString(payload["parentId"])
    if (payload === undefined || parentId === undefined) {
      continue
    }

    addHierarchyLink(index, payload.issueId, parentId)
  }

  return index
}

function canonicalEventsDir(root: string): string {
  return join(getTrackerHandles(root).trackerRoot, "events")
}

function issueEventsDir(root: string, issueId: string): string {
  return join(canonicalEventsDir(root), "by-issue", issueId)
}

function listJsonFilesRecursively(dir: string): string[] {
  if (!existsSync(dir)) {
    return []
  }

  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const entryPath = join(dir, entry)
    const stats = statSync(entryPath)
    if (stats.isDirectory()) {
      files.push(...listJsonFilesRecursively(entryPath))
      continue
    }
    if (stats.isFile() && entry.endsWith(".json")) {
      files.push(entryPath)
    }
  }

  return files
}

function readStoredEventFile(path: string): TrackerStoredEvent {
  const raw = readJsonFile<StoredEventFile>(
    path,
    storedEventFileSchema,
    `${path} is not valid JSON`,
    `Invalid stored event file '${path}'`
  )

  return {
    id: EventId(raw.id),
    type: raw.type,
    tags: [...raw.tags],
    payload: raw.payload,
    position: BigInt(raw.position),
    timestamp: new Date(raw.timestamp),
  }
}

function sortStoredEvents(events: ReadonlyArray<TrackerStoredEvent>): TrackerStoredEvent[] {
  return [...events].sort((a, b) => {
    if (a.position < b.position) return -1
    if (a.position > b.position) return 1
    return a.id.localeCompare(b.id)
  })
}

function readCanonicalEventsForIssue(root: string, issueId: string): TrackerStoredEvent[] {
  return sortStoredEvents(listJsonFilesRecursively(issueEventsDir(root, issueId)).map(readStoredEventFile))
}

function readAllCanonicalEvents(root: string): TrackerStoredEvent[] {
  return sortStoredEvents(listJsonFilesRecursively(canonicalEventsDir(root)).map(readStoredEventFile))
}

export async function readTrackedIssueAggregate(
  root: string,
  issueId: string
): Promise<IssueAggregate> {
  const events = readCanonicalEventsForIssue(root, issueId)
  const state = foldIssueState(events)

  if (state === undefined) {
    throw new Error(`Issue '${issueId}' not found`)
  }

  return {
    state,
    maxPosition: events.at(-1)?.position,
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
  const index = foldHierarchyIndex(readAllCanonicalEvents(root))

  const { parentsPath, childrenPath } = hierarchyIndexPaths(root)
  mkdirSync(hierarchyIndexDir(root), { recursive: true })
  writeFileSync(parentsPath, `${JSON.stringify(index.parentsByChild, null, 2)}\n`)
  writeFileSync(childrenPath, `${JSON.stringify(index.childrenByParent, null, 2)}\n`)
  return index
}

const LEGACY_STANDARD_FIELDS = new Set([
  "title",
  "description",
  "status",
  "phase",
  "priority",
  "created",
  "updated",
  "refs",
  "labels",
  "github_issue",
])

function optionalString(value: JsonValue | undefined): string | undefined {
  return typeof value === "string" ? value : undefined
}

function optionalNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" ? value : undefined
}

function optionalStringArray(value: JsonValue | undefined): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const strings: string[] = []
  for (const entry of value) {
    if (typeof entry !== "string") {
      return undefined
    }
    strings.push(entry)
  }
  return strings
}

function buildLegacyIssueRecord(raw: LegacyIssueFile, issueId: string): IssueRecord {
  const extras: JsonObject = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!LEGACY_STANDARD_FIELDS.has(key) && value !== undefined) {
      extras[key] = value
    }
  }

  const description = optionalString(raw["description"])
  const priority = optionalNumber(raw["priority"])
  const created = optionalString(raw["created"])
  const updated = optionalString(raw["updated"])
  const refs = optionalStringArray(raw["refs"])
  const labels = optionalStringArray(raw["labels"])
  const githubIssue = optionalNumber(raw["github_issue"])

  return {
    id: issueId,
    ...extras,
    title: raw.title,
    description: description ?? "",
    status: raw.status,
    phase: raw.phase,
    priority: priority ?? Number.POSITIVE_INFINITY,
    created: created ?? "",
    updated: updated ?? "",
    refs: refs ?? [],
    labels: labels ?? [],
    ...(githubIssue === undefined ? {} : { github_issue: githubIssue }),
  }
}

export function readLegacyIssueRecord(issueDir: string, issueId: string): IssueRecord | undefined {
  const issuePath = join(issueDir, "issue.json")
  if (!existsSync(issuePath)) {
    return undefined
  }

  try {
    const raw = readJsonFile<LegacyIssueFile>(
      issuePath,
      legacyIssueFileSchema,
      `${issuePath} is not valid JSON`,
      `Invalid legacy issue projection '${issuePath}'`
    )
    return buildLegacyIssueRecord(raw, issueId)
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
