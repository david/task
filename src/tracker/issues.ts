import { randomBytes } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"
import type { DomainEvent, SliceError, StoredEvent } from "../../packages/esther/src/index.ts"
import {
  RESERVED_METADATA_KEYS,
  foldIssueState,
  issueBoundaryTag,
  issueCreatedEvent,
  issueLabelsChangedEvent,
  issueMetadataSetEvent,
  issuePhaseChangedEvent,
  issueRefsChangedEvent,
  storeDeletedEvent,
  storeEntryDeletedEvent,
  storeRevisionFinalizedEvent,
  storeRevisionSavedEvent,
  type IssueMetadata,
  type IssueRecord,
  type IssueState,
  storedEventSchema,
} from "./events"
import { materializeHierarchyLink } from "./hierarchy"
import {
  getTrackerHandles,
  listCanonicalIssueIds,
  listProjectedIssueIds,
} from "./root"
import {
  assertAllowedPhaseTransition,
  getNextPhase,
  loadTaskSettings,
} from "./settings"
import {
  getOpenStoreDrafts,
  getStoreKeys,
  getStoreValue,
  getVisibleStores,
  materializeVisibleStores,
  planStoreRevision,
} from "./stores"

export type CreateIssueInput = {
  title: string
  description: string
  priority: number
  labels: string[]
  githubIssue?: number
  parentRef?: string
}

type QueryStoredEventsByTags = <TState>(
  tags: ReadonlyArray<string>,
  schemas: ReadonlyArray<{
    safeParse(value: unknown):
      | { success: true; data: StoredEvent }
      | { success: false; error?: unknown }
  }>,
  fold: (events: ReadonlyArray<StoredEvent>) => TState
) => Promise<{ state: TState; maxPosition: bigint | undefined }>

export type IssueAggregate = {
  state: IssueState
  maxPosition: bigint | undefined
}

const ISSUE_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"

export async function createTrackedIssue(
  root: string,
  input: CreateIssueInput
): Promise<IssueRecord> {
  const tracker = getTrackerHandles(root)
  const settings = loadTaskSettings(root)
  const parentId = input.parentRef === undefined
    ? undefined
    : await resolveOpenParentIssueId(root, input.parentRef)
  const id = generateIssueId(root)
  const issue: IssueRecord = {
    id: `${id}-${slugify(input.title)}`,
    title: input.title,
    description: input.description,
    status: "open",
    phase: settings.defaultPhase,
    priority: input.priority,
    created: new Date().toISOString().slice(0, 10),
    updated: new Date().toISOString(),
    refs: [],
    labels: [...input.labels],
    ...(input.githubIssue === undefined ? {} : { github_issue: input.githubIssue }),
  }

  const appended = await tracker.eventStore.append([issueCreatedEvent(issue, parentId)], {
    expectedPosition: undefined,
    boundaryTags: [issueBoundaryTag(issue.id)],
  })

  if (appended.isErr()) {
    throw sliceErrorToError(appended.error)
  }

  const issueDir = join(tracker.issueRoot, issue.id)
  mkdirSync(issueDir, { recursive: true })
  writeFileSync(join(issueDir, "issue.json"), `${JSON.stringify(stripIssueId(issue), null, 2)}\n`)
  materializeVisibleStores(issueDir, {})

  await materializeHierarchyLink(root, issue.id, parentId)
  return issue
}

export async function loadTrackedIssue(
  root: string,
  issueId: string
): Promise<{ id: string; metadata: IssueMetadata; stores: Record<string, string[]> }> {
  const projectionPath = await ensureIssueProjection(root, issueId)
  const metadata = JSON.parse(readFileSync(join(projectionPath, "issue.json"), "utf-8")) as IssueMetadata

  return {
    id: issueId,
    metadata,
    stores: loadIssueStores(projectionPath),
  }
}

export async function listTrackedIssues(root: string, includeAll: boolean): Promise<IssueRecord[]> {
  const archivedIds = new Set<string>(listProjectedIssueIds(root, true))
  const issueIds = new Set<string>(listProjectedIssueIds(root, false))
  for (const issueId of listCanonicalIssueIds(root)) {
    if (!archivedIds.has(issueId)) {
      issueIds.add(issueId)
    }
  }

  const issues: IssueRecord[] = []
  for (const issueId of [...issueIds].sort()) {
    const { metadata } = await loadTrackedIssue(root, issueId)
    issues.push({ id: issueId, ...metadata })
  }

  if (includeAll) {
    const tracker = getTrackerHandles(root)
    for (const issueId of [...archivedIds].sort()) {
      const projectionPath = join(tracker.archiveRoot, issueId)
      const metadata = JSON.parse(readFileSync(join(projectionPath, "issue.json"), "utf-8")) as IssueMetadata
      issues.push({ id: issueId, ...metadata })
    }
  }

  return issues
}

export async function searchTrackedIssues(
  root: string,
  includeAll: boolean,
  query: string
): Promise<IssueRecord[]> {
  const normalized = query.toLowerCase()
  const issues = await listTrackedIssues(root, includeAll)
  return issues.filter((issue) => matchesText(issue, normalized))
}

export function loadArchivedTrackedIssue(
  root: string,
  issueId: string
): { id: string; metadata: IssueMetadata; stores: Record<string, string[]> } {
  const tracker = getTrackerHandles(root)
  const issueDir = join(tracker.archiveRoot, issueId)
  const metadata = JSON.parse(readFileSync(join(issueDir, "issue.json"), "utf-8")) as IssueMetadata

  return {
    id: issueId,
    metadata,
    stores: loadIssueStores(issueDir),
  }
}

export async function readTrackedIssueAggregate(
  root: string,
  issueId: string
): Promise<IssueAggregate> {
  const tracker = getTrackerHandles(root)
  const queryByTags = tracker.eventStore.queryByTags as unknown as QueryStoredEventsByTags
  const result = await queryByTags(
    [issueBoundaryTag(issueId)],
    [storedEventSchema],
    (events) => foldIssueState(events)
  )

  if (result.state === undefined) {
    throw new Error(`Issue '${issueId}' not found`)
  }

  return {
    state: result.state,
    maxPosition: result.maxPosition,
  }
}

export async function appendTrackedIssueEvents(
  root: string,
  issueId: string,
  events: ReadonlyArray<DomainEvent>,
  expectedPosition: bigint | undefined
): Promise<IssueAggregate> {
  const tracker = getTrackerHandles(root)
  const appended = await tracker.eventStore.append(events, {
    expectedPosition,
    boundaryTags: [issueBoundaryTag(issueId)],
  })

  if (appended.isErr()) {
    throw sliceErrorToError(appended.error)
  }

  return refreshIssueProjection(root, issueId)
}

export async function setTrackedIssueMetadata(
  root: string,
  issueId: string,
  key: string,
  value: unknown
): Promise<IssueMetadata> {
  if (RESERVED_METADATA_KEYS.has(key)) {
    throw new Error(`Metadata key '${key}' is reserved; use a dedicated command instead`)
  }

  const aggregate = await readTrackedIssueAggregate(root, issueId)
  const updatedAt = new Date().toISOString()
  const next = await appendTrackedIssueEvents(
    root,
    issueId,
    [issueMetadataSetEvent(issueId, key, value, updatedAt)],
    aggregate.maxPosition
  )
  return next.state.metadata
}

export async function updateTrackedIssueArrayField(
  root: string,
  issueId: string,
  field: "labels" | "refs",
  add: string[],
  remove: string[]
): Promise<{ id: string; field: string; values: string[] }> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  const updatedAt = new Date().toISOString()
  const event = field === "labels"
    ? issueLabelsChangedEvent(issueId, add, remove, updatedAt)
    : issueRefsChangedEvent(issueId, add, remove, updatedAt)
  const next = await appendTrackedIssueEvents(root, issueId, [event], aggregate.maxPosition)

  return {
    id: issueId,
    field,
    values: field === "labels" ? [...next.state.metadata.labels] : [...next.state.metadata.refs],
  }
}

export async function getTrackedIssueNextPhase(root: string, issueId: string): Promise<string> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  const settings = loadTaskSettings(root)
  return getNextPhase(settings, aggregate.state.metadata.phase)
}

export async function setTrackedIssuePhase(
  root: string,
  issueId: string,
  nextPhase: string
): Promise<IssueMetadata> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  const settings = loadTaskSettings(root)
  const currentPhase = aggregate.state.metadata.phase
  assertAllowedPhaseTransition(settings, currentPhase, nextPhase)

  const changedAt = new Date().toISOString()
  const events: DomainEvent[] = [
    issuePhaseChangedEvent(issueId, currentPhase, nextPhase, changedAt),
    ...getOpenStoreDrafts(aggregate.state.stores).map((draft) =>
      storeRevisionFinalizedEvent({
        issueId,
        store: draft.store,
        key: draft.key,
        revision: draft.revision,
        phase: draft.phase,
        finalizedAt: changedAt,
      })
    ),
  ]

  const next = await appendTrackedIssueEvents(root, issueId, events, aggregate.maxPosition)
  return next.state.metadata
}

export async function saveTrackedStoreValue(
  root: string,
  issueId: string,
  store: string,
  key: string,
  content: string
): Promise<{ stored: true }> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  const phase = aggregate.state.metadata.phase
  const revision = planStoreRevision(aggregate.state.stores, store, key, phase)
  const savedAt = new Date().toISOString()

  await appendTrackedIssueEvents(
    root,
    issueId,
    [
      storeRevisionSavedEvent({
        issueId,
        store,
        key,
        revision: revision.revision,
        phase,
        draft: true,
        content,
        savedAt,
        ...(revision.supersedesRevision === undefined
          ? {}
          : { supersedesRevision: revision.supersedesRevision }),
      }),
    ],
    aggregate.maxPosition
  )

  return { stored: true }
}

export async function getTrackedStoreValue(
  root: string,
  issueId: string,
  store: string,
  key: string
): Promise<string | null> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  return getStoreValue(aggregate.state.stores, store, key)
}

export async function listTrackedStoreKeys(
  root: string,
  issueId: string,
  store: string
): Promise<string[]> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  return getStoreKeys(aggregate.state.stores, store)
}

export async function deleteTrackedStore(
  root: string,
  issueId: string,
  store: string,
  key?: string
): Promise<{ deleted: boolean; kind: "store" | "key"; removedEmptyStore?: boolean }> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  const deletedAt = new Date().toISOString()

  if (key === undefined) {
    if (getStoreKeys(aggregate.state.stores, store).length === 0) {
      return { deleted: false, kind: "store" }
    }

    await appendTrackedIssueEvents(
      root,
      issueId,
      [storeDeletedEvent({ issueId, store, deletedAt })],
      aggregate.maxPosition
    )
    return { deleted: true, kind: "store" }
  }

  if (getStoreValue(aggregate.state.stores, store, key) === null) {
    return { deleted: false, kind: "key" }
  }

  const next = await appendTrackedIssueEvents(
    root,
    issueId,
    [storeEntryDeletedEvent({ issueId, store, key, deletedAt })],
    aggregate.maxPosition
  )

  const remainingKeys = getStoreKeys(next.state.stores, store)
  return remainingKeys.length === 0
    ? { deleted: true, kind: "key", removedEmptyStore: true }
    : { deleted: true, kind: "key" }
}

async function refreshIssueProjection(root: string, issueId: string): Promise<IssueAggregate> {
  const aggregate = await readTrackedIssueAggregate(root, issueId)
  const archived = isArchivedIssue(root, issueId)
  const tracker = getTrackerHandles(root)
  const issueDir = archived ? join(tracker.archiveRoot, issueId) : join(tracker.issueRoot, issueId)
  mkdirSync(issueDir, { recursive: true })

  const projectedMetadata = archived
    ? { ...aggregate.state.metadata, status: "closed" as const }
    : aggregate.state.metadata

  writeFileSync(join(issueDir, "issue.json"), `${JSON.stringify(projectedMetadata, null, 2)}\n`)
  materializeVisibleStores(issueDir, getVisibleStores(aggregate.state.stores))
  return aggregate
}

async function ensureIssueProjection(root: string, issueId: string): Promise<string> {
  const tracker = getTrackerHandles(root)
  const archivedDir = join(tracker.archiveRoot, issueId)
  const activeDir = join(tracker.issueRoot, issueId)

  if (existsSync(join(archivedDir, "issue.json"))) {
    return archivedDir
  }

  if (existsSync(join(activeDir, "issue.json"))) {
    return activeDir
  }

  await refreshIssueProjection(root, issueId)
  return join(tracker.issueRoot, issueId)
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

function generateIssueId(root: string): string {
  const knownIds = new Set<string>([
    ...listProjectedIssueIds(root, false),
    ...listProjectedIssueIds(root, true),
    ...listCanonicalIssueIds(root),
  ])

  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = randomBytes(4)
    let candidate = ""
    for (let i = 0; i < 4; i++) {
      candidate += ISSUE_ID_CHARS[bytes[i] % ISSUE_ID_CHARS.length]
    }

    const collision = [...knownIds].some((issueId) => issueId.startsWith(`${candidate}-`))
    if (!collision) {
      return candidate
    }
  }

  throw new Error("Failed to generate unique ID after 100 attempts")
}

function stripIssueId(issue: IssueRecord): IssueMetadata {
  const { id: _id, ...metadata } = issue
  return metadata
}

function loadIssueStores(path: string): Record<string, string[]> {
  const stores: Record<string, string[]> = {}
  const entries = readdirSync(path)
  for (const entry of entries) {
    if (entry === "issue.json") continue
    const entryPath = join(path, entry)
    if (statSync(entryPath).isDirectory()) {
      stores[entry] = readdirSync(entryPath).sort()
    }
  }
  return stores
}

function matchesText(issue: IssueRecord, normalizedQuery: string): boolean {
  const haystacks: string[] = [issue.id, issue.title, issue.description]
  haystacks.push(...issue.refs)
  haystacks.push(...issue.labels)
  return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery))
}

type ResolvedTrackedIssue = {
  issueId: string
  archived: boolean
}

function resolveTrackedIssueId(root: string, issueRef: string): ResolvedTrackedIssue {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(issueRef)) {
    throw new Error(
      `Invalid parent issue ID '${issueRef}': must be lowercase alphanumeric (with optional slug)`
    )
  }

  const prefix = issueRef.split("-")[0]
  const archivedIds = new Set<string>(
    listProjectedIssueIds(root, true).filter((issueId) => issueId.startsWith(`${prefix}-`))
  )
  const activeIds = new Set<string>(
    listProjectedIssueIds(root, false).filter((issueId) => issueId.startsWith(`${prefix}-`))
  )

  for (const issueId of listCanonicalIssueIds(root)) {
    if (issueId.startsWith(`${prefix}-`) && !archivedIds.has(issueId)) {
      activeIds.add(issueId)
    }
  }

  const matches = [
    ...[...activeIds].sort().map((issueId) => ({ issueId, archived: false as const })),
    ...[...archivedIds].sort().map((issueId) => ({ issueId, archived: true as const })),
  ]

  if (matches.length === 0) {
    throw new Error(`Parent issue '${issueRef}' not found`)
  }

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous parent issue ID '${issueRef}': ${matches.map((match) => match.issueId).join(", ")}`
    )
  }

  return matches[0]
}

async function resolveOpenParentIssueId(root: string, parentRef: string): Promise<string> {
  const resolved = resolveTrackedIssueId(root, parentRef)
  if (resolved.archived) {
    throw new Error(`Parent issue '${parentRef}' is closed`)
  }

  const parent = await loadTrackedIssue(root, resolved.issueId)
  if (parent.metadata.status !== "open") {
    throw new Error(`Parent issue '${parentRef}' is not open`)
  }

  return parent.id
}

function isArchivedIssue(root: string, issueId: string): boolean {
  return existsSync(join(getTrackerHandles(root).archiveRoot, issueId))
}

function sliceErrorToError(error: SliceError): Error {
  return new Error("message" in error ? error.message : "Tracker operation failed")
}
