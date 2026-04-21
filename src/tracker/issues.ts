import { join } from "node:path"
import type { DomainEvent, SliceError } from "../../packages/esther/src/index.ts"
import {
  RESERVED_METADATA_KEYS,
  issueBoundaryTag,
  issueClosedEvent,
  issueDocumentDeletedEvent,
  issueDocumentRevisionFinalizedEvent,
  issueDocumentRevisionSavedEvent,
  issueDocumentSubtreeDeletedEvent,
  issueDocumentsClearedEvent,
  issueLabelsChangedEvent,
  issueMetadataSetEvent,
  issuePhaseChangedEvent,
  issueRefsChangedEvent,
  type IssueMetadata,
  type IssueRecord,
} from "./events"
import type { JsonValue } from "../types"
import { getTrackerHandles, listProjectedIssueIds } from "./root"
import {
  readIssueDocumentKeys,
  readLegacyIssueRecord,
  readTrackedIssueAggregate as readAggregate,
  rebuildCurrentIssueIndex,
  rebuildIssueProjection,
  type IssueAggregate,
} from "./projections"
import { parseDocumentSelector, parseExactDocumentPath, type DocumentSelector, joinLegacyStorePath } from "./document-paths"
import { assertAllowedPhaseTransition, getNextPhase, loadTaskSettings } from "./settings"
import { getOpenStoreDrafts, getStoreKeys, getStoreTree, getStoreValue, hasVisibleEntries, hasVisibleEntriesUnderPrefix, hasVisibleEntry, planStoreRevision } from "./stores"

export { createTrackedIssue, type CreateIssueInput } from "./issue-create"

export async function loadTrackedIssue(
  root: string,
  issueId: string
): Promise<{ id: string; metadata: IssueMetadata; keys: string[] }> {
  const canonical = await rebuildIssueProjection(root, issueId)
  const tracker = getTrackerHandles(root)

  if (canonical !== undefined) {
    const issueDir = join(tracker.issueRoot, issueId)
    return {
      id: issueId,
      metadata: canonical.state.metadata,
      keys: readIssueDocumentKeys(issueDir),
    }
  }

  const currentDir = join(tracker.issueRoot, issueId)
  const current = readLegacyIssueRecord(currentDir, issueId)
  if (current !== undefined) {
    return {
      id: issueId,
      metadata: stripIssueId(current),
      keys: readIssueDocumentKeys(currentDir),
    }
  }

  const archiveDir = join(tracker.archiveRoot, issueId)
  const archived = readLegacyIssueRecord(archiveDir, issueId)
  if (archived !== undefined) {
    return {
      id: issueId,
      metadata: stripIssueId(archived),
      keys: readIssueDocumentKeys(archiveDir),
    }
  }

  throw new Error(`Issue '${issueId}' not found`)
}

export async function listTrackedIssues(root: string, includeAll: boolean): Promise<IssueRecord[]> {
  const tracker = getTrackerHandles(root)
  const issuesById = new Map<string, IssueRecord>()

  for (const issue of await rebuildCurrentIssueIndex(root)) {
    issuesById.set(issue.id, issue)
  }

  for (const issueId of listProjectedIssueIds(root, false)) {
    if (issuesById.has(issueId)) {
      continue
    }
    const legacy = readLegacyIssueRecord(join(tracker.issueRoot, issueId), issueId)
    if (legacy !== undefined) {
      issuesById.set(issueId, legacy)
    }
  }

  let issues = [...issuesById.values()].sort((a, b) => a.id.localeCompare(b.id))
  if (!includeAll) {
    issues = issues.filter((issue) => issue.status !== "closed")
  }

  if (!includeAll) {
    return issues
  }

  for (const issueId of listProjectedIssueIds(root, true)) {
    if (issuesById.has(issueId)) {
      continue
    }
    const archived = readLegacyIssueRecord(join(tracker.archiveRoot, issueId), issueId)
    if (archived !== undefined) {
      issues.push(archived)
    }
  }

  return issues.sort((a, b) => a.id.localeCompare(b.id))
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
): { id: string; metadata: IssueMetadata; keys: string[] } {
  const tracker = getTrackerHandles(root)
  const issueDir = join(tracker.archiveRoot, issueId)
  const issue = readLegacyIssueRecord(issueDir, issueId)
  if (issue === undefined) {
    throw new Error(`Issue '${issueId}' not found`)
  }

  return {
    id: issueId,
    metadata: stripIssueId(issue),
    keys: readIssueDocumentKeys(issueDir),
  }
}

export async function readTrackedIssueAggregate(
  root: string,
  issueId: string
): Promise<IssueAggregate> {
  return readAggregate(root, issueId)
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

  const aggregate = await rebuildIssueProjection(root, issueId)
  if (aggregate === undefined) {
    throw new Error(`Issue '${issueId}' not found`)
  }
  return aggregate
}

export async function closeTrackedIssue(
  root: string,
  issueId: string
): Promise<{ closed: true } | { already_closed: true }> {
  const aggregate = await readAggregate(root, issueId)
  if (aggregate.state.metadata.status === "closed") {
    await rebuildIssueProjection(root, issueId)
    return { already_closed: true }
  }

  await appendTrackedIssueEvents(
    root,
    issueId,
    [issueClosedEvent(issueId, new Date().toISOString())],
    aggregate.maxPosition
  )
  return { closed: true }
}

export async function setTrackedIssueMetadata(
  root: string,
  issueId: string,
  key: string,
  value: JsonValue
): Promise<IssueMetadata> {
  if (RESERVED_METADATA_KEYS.has(key)) {
    throw new Error(`Metadata key '${key}' is reserved; use a dedicated command instead`)
  }

  const aggregate = await readAggregate(root, issueId)
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
  const aggregate = await readAggregate(root, issueId)
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
  const aggregate = await readMaterializedIssueAggregate(root, issueId)
  const settings = loadTaskSettings(root)
  return getNextPhase(settings, aggregate.state.metadata.phase)
}

export async function setTrackedIssuePhase(
  root: string,
  issueId: string,
  nextPhase: string
): Promise<IssueMetadata> {
  const aggregate = await readAggregate(root, issueId)
  const settings = loadTaskSettings(root)
  const currentPhase = aggregate.state.metadata.phase
  assertAllowedPhaseTransition(settings, currentPhase, nextPhase)

  const changedAt = new Date().toISOString()
  const events: DomainEvent[] = [
    issuePhaseChangedEvent(issueId, currentPhase, nextPhase, changedAt),
    ...getOpenStoreDrafts(aggregate.state.stores).map((draft) =>
      issueDocumentRevisionFinalizedEvent({
        issueId,
        path: draft.path,
        revision: draft.revision,
        phase: draft.phase,
        finalizedAt: changedAt,
      })
    ),
  ]

  const next = await appendTrackedIssueEvents(root, issueId, events, aggregate.maxPosition)
  return next.state.metadata
}

export async function saveTrackedDocument(
  root: string,
  issueId: string,
  path: string,
  content: string
): Promise<{ stored: true }> {
  const canonicalPath = parseExactDocumentPath(path)
  const aggregate = await readAggregate(root, issueId)
  const phase = aggregate.state.metadata.phase
  const revision = planStoreRevision(aggregate.state.stores, canonicalPath, phase)
  const savedAt = new Date().toISOString()

  await appendTrackedIssueEvents(
    root,
    issueId,
    [
      issueDocumentRevisionSavedEvent({
        issueId,
        path: canonicalPath,
        revision: revision.revision,
        phase,
        draft: true,
        content,
        savedAt,
        ...("supersedesRevision" in revision
          ? { supersedesRevision: revision.supersedesRevision }
          : {}),
      }),
    ],
    aggregate.maxPosition
  )

  return { stored: true }
}

export async function getTrackedDocumentTree(root: string, issueId: string, selector: DocumentSelector) {
  const aggregate = await readMaterializedIssueAggregate(root, issueId)
  return getStoreTree(aggregate.state.stores, selector)
}

type DocumentDeleteResult = { deleted: boolean; kind: "exact" | "subtree" | "root" }

type StoreDeleteResult =
  | { deleted: false; kind: "store" }
  | { deleted: true; kind: "store" }
  | { deleted: false; kind: "key" }
  | { deleted: true; kind: "key" }
  | { deleted: true; kind: "key"; removedEmptyStore: true }

export async function deleteTrackedDocument(
  root: string,
  issueId: string,
  selector: DocumentSelector
): Promise<DocumentDeleteResult> {
  const aggregate = await readAggregate(root, issueId)
  const deletedAt = new Date().toISOString()

  if (selector.kind === "root") {
    if (!hasVisibleEntries(aggregate.state.stores)) {
      return { deleted: false, kind: "root" }
    }

    await appendTrackedIssueEvents(
      root,
      issueId,
      [issueDocumentsClearedEvent({ issueId, deletedAt })],
      aggregate.maxPosition
    )
    return { deleted: true, kind: "root" }
  }

  if (selector.kind === "subtree") {
    if (!hasVisibleEntriesUnderPrefix(aggregate.state.stores, selector.path)) {
      return { deleted: false, kind: "subtree" }
    }

    await appendTrackedIssueEvents(
      root,
      issueId,
      [issueDocumentSubtreeDeletedEvent({ issueId, pathPrefix: selector.path, deletedAt })],
      aggregate.maxPosition
    )
    return { deleted: true, kind: "subtree" }
  }

  if (!hasVisibleEntry(aggregate.state.stores, selector.path)) {
    return { deleted: false, kind: "exact" }
  }

  await appendTrackedIssueEvents(
    root,
    issueId,
    [issueDocumentDeletedEvent({ issueId, path: selector.path, deletedAt })],
    aggregate.maxPosition
  )
  return { deleted: true, kind: "exact" }
}

export async function saveTrackedStoreValue(
  root: string,
  issueId: string,
  store: string,
  key: string,
  content: string
): Promise<{ stored: true }> {
  return saveTrackedDocument(root, issueId, joinLegacyStorePath(store, key), content)
}

export async function getTrackedStoreValue(
  root: string,
  issueId: string,
  store: string,
  key: string
): Promise<string | null> {
  const aggregate = await readMaterializedIssueAggregate(root, issueId)
  return getStoreValue(aggregate.state.stores, joinLegacyStorePath(store, key))
}

export async function listTrackedStoreKeys(
  root: string,
  issueId: string,
  store: string
): Promise<string[]> {
  const aggregate = await readMaterializedIssueAggregate(root, issueId)
  return getStoreKeys(aggregate.state.stores, store)
}

export async function deleteTrackedStore(
  root: string,
  issueId: string,
  store: string,
  key?: string
): Promise<StoreDeleteResult> {
  const result = await deleteTrackedDocument(
    root,
    issueId,
    key === undefined ? parseDocumentSelector(`${store}/`) : parseDocumentSelector(joinLegacyStorePath(store, key))
  )

  if (key === undefined) {
    return { deleted: result.deleted, kind: "store" }
  }

  if (!result.deleted) {
    return { deleted: false, kind: "key" }
  }

  const remainingKeys = await listTrackedStoreKeys(root, issueId, store)
  return remainingKeys.length === 0
    ? { deleted: true, kind: "key", removedEmptyStore: true }
    : { deleted: true, kind: "key" }
}

async function readMaterializedIssueAggregate(root: string, issueId: string): Promise<IssueAggregate> {
  const aggregate = await rebuildIssueProjection(root, issueId)
  if (aggregate === undefined) {
    throw new Error(`Issue '${issueId}' not found`)
  }
  return aggregate
}

function stripIssueId(issue: IssueRecord): IssueMetadata {
  const { id: _id, ...metadata } = issue
  return metadata
}

function matchesText(issue: IssueRecord, normalizedQuery: string): boolean {
  const haystacks: string[] = [issue.id, issue.title, issue.description]
  haystacks.push(...issue.refs)
  haystacks.push(...issue.labels)
  return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery))
}

function sliceErrorToError(error: SliceError): Error {
  return new Error("message" in error ? error.message : "Tracker operation failed")
}
