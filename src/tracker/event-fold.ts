import {
  applyStoreDeleted,
  applyStoreEntryDeleted,
  applyStoreRevisionFinalized,
  applyStoreRevisionSaved,
  createEmptyIssueStoreState,
} from "./stores"
import {
  RESERVED_METADATA_KEYS,
  type IssueMetadata,
  type IssueState,
  type TrackerStoredEvent,
} from "./event-core"
import {
  parseIssueClosedPayload,
  parseIssueCreatedPayload,
  parseIssueLabelsChangedPayload,
  parseIssueMetadataSetPayload,
  parseIssuePhaseChangedPayload,
  parseIssueRefsChangedPayload,
  parseStoreDeletedPayload,
  parseStoreEntryDeletedPayload,
  parseStoreRevisionFinalizedPayload,
  parseStoreRevisionSavedPayload,
} from "./event-parsers"

function createIssueState(event: TrackerStoredEvent): IssueState | undefined {
  const payload = parseIssueCreatedPayload(event.payload)
  if (!payload) return undefined

  return {
    metadata: {
      title: payload.title,
      description: payload.description,
      status: payload.status,
      phase: payload.phase,
      priority: payload.priority,
      created: payload.created,
      updated: payload.updated,
      refs: [...payload.refs],
      labels: [...payload.labels],
      ...("github_issue" in payload ? { github_issue: payload.github_issue } : {}),
    },
    ...("parentId" in payload ? { parentId: payload.parentId } : {}),
    stores: createEmptyIssueStoreState(),
  }
}

function applyClosed(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseIssueClosedPayload(event.payload)
  if (!payload) return
  current.metadata.status = "closed"
  current.metadata.updated = payload.closedAt
}

function applyPhaseChanged(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseIssuePhaseChangedPayload(event.payload)
  if (!payload) return
  current.metadata.phase = payload.to
  current.metadata.updated = payload.changedAt
}

function applyMetadataSet(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseIssueMetadataSetPayload(event.payload)
  if (!payload || RESERVED_METADATA_KEYS.has(payload.key)) return
  current.metadata[payload.key] = payload.value
  current.metadata.updated = payload.updatedAt
}

function applyLabelsChanged(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseIssueLabelsChangedPayload(event.payload)
  if (!payload) return
  const values = new Set(current.metadata.labels)
  for (const value of payload.removed) values.delete(value)
  for (const value of payload.added) values.add(value)
  current.metadata.labels = [...values]
  current.metadata.updated = payload.updatedAt
}

function applyRefsChanged(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseIssueRefsChangedPayload(event.payload)
  if (!payload) return
  const values = new Set(current.metadata.refs)
  for (const value of payload.removed) values.delete(value)
  for (const value of payload.added) values.add(value)
  current.metadata.refs = [...values]
  current.metadata.updated = payload.updatedAt
}

function applyStoreRevisionSavedEvent(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseStoreRevisionSavedPayload(event.payload)
  if (!payload) return
  applyStoreRevisionSaved(current.stores, {
    store: payload.store,
    key: payload.key,
    revision: payload.revision,
    phase: payload.phase,
    content: payload.content,
    draft: payload.draft,
  })
  current.metadata.updated = payload.savedAt
}

function applyStoreRevisionFinalizedEvent(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseStoreRevisionFinalizedPayload(event.payload)
  if (!payload) return
  applyStoreRevisionFinalized(current.stores, payload)
  current.metadata.updated = payload.finalizedAt
}

function applyStoreEntryDeletedEvent(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseStoreEntryDeletedPayload(event.payload)
  if (!payload) return
  applyStoreEntryDeleted(current.stores, payload.store, payload.key)
  current.metadata.updated = payload.deletedAt
}

function applyStoreDeletedEvent(current: IssueState, event: TrackerStoredEvent): void {
  const payload = parseStoreDeletedPayload(event.payload)
  if (!payload) return
  applyStoreDeleted(current.stores, payload.store)
  current.metadata.updated = payload.deletedAt
}

function applyEvent(current: IssueState, event: TrackerStoredEvent): void {
  switch (event.type) {
    case "IssueClosed":
      applyClosed(current, event)
      return
    case "IssuePhaseChanged":
      applyPhaseChanged(current, event)
      return
    case "IssueMetadataSet":
      applyMetadataSet(current, event)
      return
    case "IssueLabelsChanged":
      applyLabelsChanged(current, event)
      return
    case "IssueRefsChanged":
      applyRefsChanged(current, event)
      return
    case "StoreRevisionSaved":
      applyStoreRevisionSavedEvent(current, event)
      return
    case "StoreRevisionFinalized":
      applyStoreRevisionFinalizedEvent(current, event)
      return
    case "StoreEntryDeleted":
      applyStoreEntryDeletedEvent(current, event)
      return
    case "StoreDeleted":
      applyStoreDeletedEvent(current, event)
      return
  }
}

export function foldIssue(events: ReadonlyArray<TrackerStoredEvent>): IssueMetadata | undefined {
  return foldIssueState(events)?.metadata
}

export function foldIssueState(events: ReadonlyArray<TrackerStoredEvent>): IssueState | undefined {
  let current: IssueState | undefined

  for (const event of events) {
    if (event.type === "IssueCreated") {
      current = createIssueState(event)
      continue
    }
    if (current === undefined) {
      continue
    }
    applyEvent(current, event)
  }

  return current
}
