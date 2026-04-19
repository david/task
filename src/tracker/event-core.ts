import type { DomainEvent, StoredEvent } from "../../packages/esther/src/index.ts"
import type { JsonValue } from "../types"
import type { IssueStoreState } from "./stores"
import type {
  IssueClosedPayload,
  IssueCreatedPayload,
  IssueLabelsChangedPayload,
  IssueMetadata,
  IssueMetadataSetPayload,
  IssuePhaseChangedPayload,
  IssueRecord,
  IssueRefsChangedPayload,
  StoreDeletedPayload,
  StoreEntryDeletedPayload,
  StoreRevisionFinalizedPayload,
  StoreRevisionSavedPayload,
} from "./schemas"

export {
  issueClosedPayloadSchema,
  issueCreatedPayloadSchema,
  issueLabelsChangedPayloadSchema,
  issueMetadataSchema,
  issueMetadataSetPayloadSchema,
  issuePhaseChangedPayloadSchema,
  issueRecordSchema,
  issueRefsChangedPayloadSchema,
  issueStatusSchema,
  legacyIssueFileSchema,
  storedEventFileSchema,
  storeDeletedPayloadSchema,
  storeEntryDeletedPayloadSchema,
  storeRevisionFinalizedPayloadSchema,
  storeRevisionSavedPayloadSchema,
  trackerStoredEventSchema,
  type IssueClosedPayload,
  type IssueCreatedPayload,
  type IssueLabelsChangedPayload,
  type IssueMetadata,
  type IssueMetadataSetPayload,
  type IssuePhaseChangedPayload,
  type IssueRecord,
  type IssueRefsChangedPayload,
  type LegacyIssueFile,
  type StoredEventFile,
  type StoreDeletedPayload,
  type StoreEntryDeletedPayload,
  type StoreRevisionFinalizedPayload,
  type StoreRevisionSavedPayload,
} from "./schemas"

export const RESERVED_METADATA_KEYS = new Set(["status", "phase", "parentId"])

export type IssueState =
  | { metadata: IssueMetadata; stores: IssueStoreState }
  | { metadata: IssueMetadata; parentId: string; stores: IssueStoreState }

export type TrackerStoredEvent = StoredEvent<string, JsonValue>

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
