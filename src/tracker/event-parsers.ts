import type { JsonObject, JsonValue } from "../types"
import type {
  IssueClosedPayload,
  IssueCreatedPayload,
  IssueLabelsChangedPayload,
  IssueMetadataSetPayload,
  IssuePhaseChangedPayload,
  IssueRefsChangedPayload,
  StoreDeletedPayload,
  StoreEntryDeletedPayload,
  StoreRevisionFinalizedPayload,
  StoreRevisionSavedPayload,
  TrackerStoredEvent,
} from "./event-core"

type ParseSuccess<T> = {
  success: true
  data: T
}

type ParseFailure = {
  success: false
  error: string
}

type StoredEventLike = JsonObject

export const storedEventSchema = {
  safeParse(value: TrackerStoredEvent | StoredEventLike | null): ParseSuccess<TrackerStoredEvent> | ParseFailure {
    if (!isStoredEvent(value)) {
      return { success: false, error: "not a StoredEvent" }
    }
    return { success: true, data: value }
  },
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
  return { issueId: value.issueId, from: value.from, to: value.to, changedAt: value.changedAt }
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
  return { issueId: value.issueId, key: value.key, value: value.value, updatedAt: value.updatedAt }
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
  return { issueId: value.issueId, added: [...value.added], removed: [...value.removed], updatedAt: value.updatedAt }
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
  return { issueId: value.issueId, added: [...value.added], removed: [...value.removed], updatedAt: value.updatedAt }
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
    ...(value.supersedesRevision === undefined ? {} : { supersedesRevision: value.supersedesRevision }),
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
  return { issueId: value.issueId, store: value.store, key: value.key, deletedAt: value.deletedAt }
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
  return { issueId: value.issueId, store: value.store, deletedAt: value.deletedAt }
}
