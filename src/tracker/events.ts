import type { DomainEvent, StoredEvent } from "../../packages/esther/src/index.ts"
import type { JsonObject, JsonValue } from "../types"
import {
  applyStoreDeleted,
  applyStoreEntryDeleted,
  applyStoreRevisionFinalized,
  applyStoreRevisionSaved,
  createEmptyIssueStoreState,
  type IssueStoreState,
} from "./stores"

export const RESERVED_METADATA_KEYS = new Set(["status", "phase", "parentId"])

export type IssueMetadata = {
  title: string
  description: string
  status: "open" | "closed"
  phase: string
  priority: number
  created: string
  updated: string
  refs: string[]
  labels: string[]
  github_issue?: number
} & JsonObject

export type IssueRecord = IssueMetadata & {
  id: string
}

export type IssueState = {
  metadata: IssueMetadata
  parentId?: string
  stores: IssueStoreState
}

export type TrackerStoredEvent = StoredEvent<string, JsonValue>

export type IssueCreatedPayload = IssueMetadata & {
  issueId: string
  parentId?: string
}

export type IssuePhaseChangedPayload = {
  issueId: string
  from: string
  to: string
  changedAt: string
}

export type IssueMetadataSetPayload = {
  issueId: string
  key: string
  value: JsonValue
  updatedAt: string
}

export type IssueLabelsChangedPayload = {
  issueId: string
  added: string[]
  removed: string[]
  updatedAt: string
}

export type IssueRefsChangedPayload = {
  issueId: string
  added: string[]
  removed: string[]
  updatedAt: string
}

export type IssueClosedPayload = {
  issueId: string
  closedAt: string
}

export type StoreRevisionSavedPayload = {
  issueId: string
  store: string
  key: string
  revision: number
  phase: string
  draft: boolean
  content: string
  supersedesRevision?: number
  savedAt: string
}

export type StoreRevisionFinalizedPayload = {
  issueId: string
  store: string
  key: string
  revision: number
  phase: string
  finalizedAt: string
}

export type StoreEntryDeletedPayload = {
  issueId: string
  store: string
  key: string
  deletedAt: string
}

export type StoreDeletedPayload = {
  issueId: string
  store: string
  deletedAt: string
}

type ParseSuccess<T> = {
  success: true
  data: T
}

type ParseFailure = {
  success: false
  error: string
}

type StoredEventLike = JsonObject & {
  payload?: JsonValue
  id?: JsonValue
  type?: JsonValue
  tags?: JsonValue
  position?: JsonValue | bigint
  timestamp?: JsonValue | Date
}

export const storedEventSchema = {
  safeParse(value: TrackerStoredEvent | StoredEventLike | null): ParseSuccess<TrackerStoredEvent> | ParseFailure {
    if (!isStoredEvent(value)) {
      return { success: false, error: "not a StoredEvent" }
    }
    return { success: true, data: value }
  },
}

export function issueBoundaryTag(issueId: string): string {
  return `issue:${issueId}`
}

export function parentTag(parentId: string): string {
  return `parent:${parentId}`
}

export function storeTag(store: string): string {
  return `store:${store}`
}

export function issueCreatedEvent(
  issue: IssueRecord,
  parentId?: string
): DomainEvent<"IssueCreated", IssueCreatedPayload> {
  return {
    type: "IssueCreated",
    tags: [
      issueBoundaryTag(issue.id),
      "kind:issue",
      ...(parentId === undefined ? [] : [parentTag(parentId)]),
    ],
    payload: {
      issueId: issue.id,
      title: issue.title,
      description: issue.description,
      status: issue.status,
      phase: issue.phase,
      priority: issue.priority,
      created: issue.created,
      updated: issue.updated,
      refs: [...issue.refs],
      labels: [...issue.labels],
      ...(issue.github_issue === undefined ? {} : { github_issue: issue.github_issue }),
      ...(parentId === undefined ? {} : { parentId }),
    },
  }
}

export function issuePhaseChangedEvent(
  issueId: string,
  from: string,
  to: string,
  changedAt: string
): DomainEvent<"IssuePhaseChanged", IssuePhaseChangedPayload> {
  return {
    type: "IssuePhaseChanged",
    tags: [issueBoundaryTag(issueId), `phase:${to}`],
    payload: { issueId, from, to, changedAt },
  }
}

export function issueMetadataSetEvent(
  issueId: string,
  key: string,
  value: JsonValue,
  updatedAt: string
): DomainEvent<"IssueMetadataSet", IssueMetadataSetPayload> {
  return {
    type: "IssueMetadataSet",
    tags: [issueBoundaryTag(issueId)],
    payload: { issueId, key, value, updatedAt },
  }
}

export function issueLabelsChangedEvent(
  issueId: string,
  added: string[],
  removed: string[],
  updatedAt: string
): DomainEvent<"IssueLabelsChanged", IssueLabelsChangedPayload> {
  return {
    type: "IssueLabelsChanged",
    tags: [issueBoundaryTag(issueId)],
    payload: { issueId, added: [...added], removed: [...removed], updatedAt },
  }
}

export function issueRefsChangedEvent(
  issueId: string,
  added: string[],
  removed: string[],
  updatedAt: string
): DomainEvent<"IssueRefsChanged", IssueRefsChangedPayload> {
  return {
    type: "IssueRefsChanged",
    tags: [issueBoundaryTag(issueId)],
    payload: { issueId, added: [...added], removed: [...removed], updatedAt },
  }
}

export function issueClosedEvent(
  issueId: string,
  closedAt: string
): DomainEvent<"IssueClosed", IssueClosedPayload> {
  return {
    type: "IssueClosed",
    tags: [issueBoundaryTag(issueId)],
    payload: { issueId, closedAt },
  }
}

export function storeRevisionSavedEvent(
  payload: StoreRevisionSavedPayload
): DomainEvent<"StoreRevisionSaved", StoreRevisionSavedPayload> {
  return {
    type: "StoreRevisionSaved",
    tags: [issueBoundaryTag(payload.issueId), storeTag(payload.store)],
    payload,
  }
}

export function storeRevisionFinalizedEvent(
  payload: StoreRevisionFinalizedPayload
): DomainEvent<"StoreRevisionFinalized", StoreRevisionFinalizedPayload> {
  return {
    type: "StoreRevisionFinalized",
    tags: [issueBoundaryTag(payload.issueId), storeTag(payload.store)],
    payload,
  }
}

export function storeEntryDeletedEvent(
  payload: StoreEntryDeletedPayload
): DomainEvent<"StoreEntryDeleted", StoreEntryDeletedPayload> {
  return {
    type: "StoreEntryDeleted",
    tags: [issueBoundaryTag(payload.issueId), storeTag(payload.store)],
    payload,
  }
}

export function storeDeletedEvent(
  payload: StoreDeletedPayload
): DomainEvent<"StoreDeleted", StoreDeletedPayload> {
  return {
    type: "StoreDeleted",
    tags: [issueBoundaryTag(payload.issueId), storeTag(payload.store)],
    payload,
  }
}

export function foldIssue(events: ReadonlyArray<TrackerStoredEvent>): IssueMetadata | undefined {
  return foldIssueState(events)?.metadata
}

export function foldIssueState(events: ReadonlyArray<TrackerStoredEvent>): IssueState | undefined {
  let current: IssueState | undefined

  for (const event of events) {
    if (event.type === "IssueCreated") {
      const payload = parseIssueCreatedPayload(event.payload)
      if (!payload) continue

      current = {
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
          ...(payload.github_issue === undefined ? {} : { github_issue: payload.github_issue }),
        },
        ...(payload.parentId === undefined ? {} : { parentId: payload.parentId }),
        stores: createEmptyIssueStoreState(),
      }
      continue
    }

    if (current === undefined) {
      continue
    }

    if (event.type === "IssueClosed") {
      const payload = parseIssueClosedPayload(event.payload)
      if (!payload) continue
      current.metadata.status = "closed"
      current.metadata.updated = payload.closedAt
      continue
    }

    if (event.type === "IssuePhaseChanged") {
      const payload = parseIssuePhaseChangedPayload(event.payload)
      if (!payload) continue
      current.metadata.phase = payload.to
      current.metadata.updated = payload.changedAt
      continue
    }

    if (event.type === "IssueMetadataSet") {
      const payload = parseIssueMetadataSetPayload(event.payload)
      if (!payload) continue
      if (RESERVED_METADATA_KEYS.has(payload.key)) {
        continue
      }
      current.metadata[payload.key] = payload.value
      current.metadata.updated = payload.updatedAt
      continue
    }

    if (event.type === "IssueLabelsChanged") {
      const payload = parseIssueLabelsChangedPayload(event.payload)
      if (!payload) continue
      const values = new Set(current.metadata.labels)
      for (const value of payload.removed) values.delete(value)
      for (const value of payload.added) values.add(value)
      current.metadata.labels = [...values]
      current.metadata.updated = payload.updatedAt
      continue
    }

    if (event.type === "IssueRefsChanged") {
      const payload = parseIssueRefsChangedPayload(event.payload)
      if (!payload) continue
      const values = new Set(current.metadata.refs)
      for (const value of payload.removed) values.delete(value)
      for (const value of payload.added) values.add(value)
      current.metadata.refs = [...values]
      current.metadata.updated = payload.updatedAt
      continue
    }

    if (event.type === "StoreRevisionSaved") {
      const payload = parseStoreRevisionSavedPayload(event.payload)
      if (!payload) continue
      applyStoreRevisionSaved(current.stores, {
        store: payload.store,
        key: payload.key,
        revision: payload.revision,
        phase: payload.phase,
        content: payload.content,
        draft: payload.draft,
      })
      current.metadata.updated = payload.savedAt
      continue
    }

    if (event.type === "StoreRevisionFinalized") {
      const payload = parseStoreRevisionFinalizedPayload(event.payload)
      if (!payload) continue
      applyStoreRevisionFinalized(current.stores, payload)
      current.metadata.updated = payload.finalizedAt
      continue
    }

    if (event.type === "StoreEntryDeleted") {
      const payload = parseStoreEntryDeletedPayload(event.payload)
      if (!payload) continue
      applyStoreEntryDeleted(current.stores, payload.store, payload.key)
      current.metadata.updated = payload.deletedAt
      continue
    }

    if (event.type === "StoreDeleted") {
      const payload = parseStoreDeletedPayload(event.payload)
      if (!payload) continue
      applyStoreDeleted(current.stores, payload.store)
      current.metadata.updated = payload.deletedAt
    }
  }

  return current
}

function isStoredEvent(value: TrackerStoredEvent | StoredEventLike | null): value is TrackerStoredEvent {
  if (!isRecord(value)) return false
  return (
    typeof value.id === "string" &&
    typeof value.type === "string" &&
    Array.isArray(value.tags) &&
    isJsonValue(value.payload) &&
    typeof value.position === "bigint" &&
    value.timestamp instanceof Date
  )
}

function isRecord(value: JsonValue | object | null | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isJsonValue(value: JsonValue | object | null | undefined): value is JsonValue {
  if (value === null) return true
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true
  }
  if (Array.isArray(value)) {
    return value.every((item) => isJsonValue(item))
  }
  if (isRecord(value)) {
    return Object.values(value).every((item) => isJsonValue(item))
  }
  return false
}

function isStringArray(value: JsonValue | object | null): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isTimestamp(value: JsonValue | object | null): value is string {
  return typeof value === "string" && value.length > 0
}

export function parseIssueCreatedPayload(value: JsonValue | object | null): IssueCreatedPayload | undefined {
  if (!isRecord(value)) return undefined

  if (
    typeof value.issueId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    (value.status !== "open" && value.status !== "closed") ||
    typeof value.phase !== "string" ||
    typeof value.priority !== "number" ||
    !isTimestamp(value.created) ||
    !isTimestamp(value.updated) ||
    !isStringArray(value.refs) ||
    !isStringArray(value.labels)
  ) {
    return undefined
  }

  if (value.github_issue !== undefined && typeof value.github_issue !== "number") {
    return undefined
  }

  if (value.parentId !== undefined && typeof value.parentId !== "string") {
    return undefined
  }

  return {
    issueId: value.issueId,
    title: value.title,
    description: value.description,
    status: value.status,
    phase: value.phase,
    priority: value.priority,
    created: value.created,
    updated: value.updated,
    refs: [...value.refs],
    labels: [...value.labels],
    ...(value.github_issue === undefined ? {} : { github_issue: value.github_issue }),
    ...(value.parentId === undefined ? {} : { parentId: value.parentId }),
  }
}

export function parseIssuePhaseChangedPayload(
  value: JsonValue | object | null
): IssuePhaseChangedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    typeof value.from !== "string" ||
    typeof value.to !== "string" ||
    !isTimestamp(value.changedAt)
  ) {
    return undefined
  }
  return {
    issueId: value.issueId,
    from: value.from,
    to: value.to,
    changedAt: value.changedAt,
  }
}

export function parseIssueMetadataSetPayload(
  value: JsonValue | object | null
): IssueMetadataSetPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    typeof value.key !== "string" ||
    !isJsonValue(value.value) ||
    !isTimestamp(value.updatedAt)
  ) {
    return undefined
  }
  return {
    issueId: value.issueId,
    key: value.key,
    value: value.value,
    updatedAt: value.updatedAt,
  }
}

export function parseIssueLabelsChangedPayload(
  value: JsonValue | object | null
): IssueLabelsChangedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    !isStringArray(value.added) ||
    !isStringArray(value.removed) ||
    !isTimestamp(value.updatedAt)
  ) {
    return undefined
  }
  return {
    issueId: value.issueId,
    added: [...value.added],
    removed: [...value.removed],
    updatedAt: value.updatedAt,
  }
}

export function parseIssueRefsChangedPayload(
  value: JsonValue | object | null
): IssueRefsChangedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    !isStringArray(value.added) ||
    !isStringArray(value.removed) ||
    !isTimestamp(value.updatedAt)
  ) {
    return undefined
  }
  return {
    issueId: value.issueId,
    added: [...value.added],
    removed: [...value.removed],
    updatedAt: value.updatedAt,
  }
}

export function parseIssueClosedPayload(value: JsonValue | object | null): IssueClosedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (typeof value.issueId !== "string" || !isTimestamp(value.closedAt)) {
    return undefined
  }
  return { issueId: value.issueId, closedAt: value.closedAt }
}

export function parseStoreRevisionSavedPayload(
  value: JsonValue | object | null
): StoreRevisionSavedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    typeof value.store !== "string" ||
    typeof value.key !== "string" ||
    typeof value.revision !== "number" ||
    typeof value.phase !== "string" ||
    typeof value.draft !== "boolean" ||
    typeof value.content !== "string" ||
    !isTimestamp(value.savedAt)
  ) {
    return undefined
  }

  if (value.supersedesRevision !== undefined && typeof value.supersedesRevision !== "number") {
    return undefined
  }

  return {
    issueId: value.issueId,
    store: value.store,
    key: value.key,
    revision: value.revision,
    phase: value.phase,
    draft: value.draft,
    content: value.content,
    savedAt: value.savedAt,
    ...(value.supersedesRevision === undefined
      ? {}
      : { supersedesRevision: value.supersedesRevision }),
  }
}

export function parseStoreRevisionFinalizedPayload(
  value: JsonValue | object | null
): StoreRevisionFinalizedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    typeof value.store !== "string" ||
    typeof value.key !== "string" ||
    typeof value.revision !== "number" ||
    typeof value.phase !== "string" ||
    !isTimestamp(value.finalizedAt)
  ) {
    return undefined
  }
  return {
    issueId: value.issueId,
    store: value.store,
    key: value.key,
    revision: value.revision,
    phase: value.phase,
    finalizedAt: value.finalizedAt,
  }
}

export function parseStoreEntryDeletedPayload(
  value: JsonValue | object | null
): StoreEntryDeletedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    typeof value.store !== "string" ||
    typeof value.key !== "string" ||
    !isTimestamp(value.deletedAt)
  ) {
    return undefined
  }
  return {
    issueId: value.issueId,
    store: value.store,
    key: value.key,
    deletedAt: value.deletedAt,
  }
}

export function parseStoreDeletedPayload(value: JsonValue | object | null): StoreDeletedPayload | undefined {
  if (!isRecord(value)) return undefined
  if (
    typeof value.issueId !== "string" ||
    typeof value.store !== "string" ||
    !isTimestamp(value.deletedAt)
  ) {
    return undefined
  }
  return {
    issueId: value.issueId,
    store: value.store,
    deletedAt: value.deletedAt,
  }
}
