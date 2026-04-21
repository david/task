import { EventId } from "../../packages/esther/src/index.ts"
import { safeParseWithSchema } from "../json-schema"
import type { JsonValue } from "../types"
import type {
  IssueClosedPayload,
  IssueCreatedPayload,
  IssueLabelsChangedPayload,
  IssueMetadataSetPayload,
  IssuePhaseChangedPayload,
  IssueRefsChangedPayload,
  IssueDocumentDeletedPayload,
  IssueDocumentRevisionFinalizedPayload,
  IssueDocumentRevisionSavedPayload,
  IssueDocumentSubtreeDeletedPayload,
  IssueDocumentsClearedPayload,
  StoreDeletedPayload,
  StoreEntryDeletedPayload,
  StoreRevisionFinalizedPayload,
  StoreRevisionSavedPayload,
  TrackerStoredEvent,
} from "./event-core"
import {
  issueClosedPayloadSchema,
  issueCreatedPayloadSchema,
  issueLabelsChangedPayloadSchema,
  issueMetadataSetPayloadSchema,
  issuePhaseChangedPayloadSchema,
  issueRefsChangedPayloadSchema,
  issueDocumentDeletedPayloadSchema,
  issueDocumentRevisionFinalizedPayloadSchema,
  issueDocumentRevisionSavedPayloadSchema,
  issueDocumentSubtreeDeletedPayloadSchema,
  issueDocumentsClearedPayloadSchema,
  storeDeletedPayloadSchema,
  storeEntryDeletedPayloadSchema,
  storeRevisionFinalizedPayloadSchema,
  storeRevisionSavedPayloadSchema,
  trackerStoredEventSchema,
} from "./event-core"

type ParseSuccess<T> = {
  success: true
  data: T
}

type ParseFailure = {
  success: false
  error: string
}

export const storedEventSchema = {
  safeParse(value: JsonValue): ParseSuccess<TrackerStoredEvent> | ParseFailure {
    const data = safeParseWithSchema(trackerStoredEventSchema, value)
    if (data === undefined) {
      return { success: false, error: "not a StoredEvent" }
    }
    return {
      success: true,
      data: {
        ...data,
        id: EventId(data.id),
      },
    }
  },
}

export function parseIssueCreatedPayload(value: JsonValue): IssueCreatedPayload | undefined {
  return safeParseWithSchema(issueCreatedPayloadSchema, value)
}

export function parseIssuePhaseChangedPayload(value: JsonValue): IssuePhaseChangedPayload | undefined {
  return safeParseWithSchema(issuePhaseChangedPayloadSchema, value)
}

export function parseIssueMetadataSetPayload(value: JsonValue): IssueMetadataSetPayload | undefined {
  return safeParseWithSchema(issueMetadataSetPayloadSchema, value)
}

export function parseIssueLabelsChangedPayload(value: JsonValue): IssueLabelsChangedPayload | undefined {
  return safeParseWithSchema(issueLabelsChangedPayloadSchema, value)
}

export function parseIssueRefsChangedPayload(value: JsonValue): IssueRefsChangedPayload | undefined {
  return safeParseWithSchema(issueRefsChangedPayloadSchema, value)
}

export function parseIssueClosedPayload(value: JsonValue): IssueClosedPayload | undefined {
  return safeParseWithSchema(issueClosedPayloadSchema, value)
}

export function parseStoreRevisionSavedPayload(value: JsonValue): StoreRevisionSavedPayload | undefined {
  return safeParseWithSchema(storeRevisionSavedPayloadSchema, value)
}

export function parseStoreRevisionFinalizedPayload(value: JsonValue): StoreRevisionFinalizedPayload | undefined {
  return safeParseWithSchema(storeRevisionFinalizedPayloadSchema, value)
}

export function parseStoreEntryDeletedPayload(value: JsonValue): StoreEntryDeletedPayload | undefined {
  return safeParseWithSchema(storeEntryDeletedPayloadSchema, value)
}

export function parseStoreDeletedPayload(value: JsonValue): StoreDeletedPayload | undefined {
  return safeParseWithSchema(storeDeletedPayloadSchema, value)
}

export function parseIssueDocumentRevisionSavedPayload(value: JsonValue): IssueDocumentRevisionSavedPayload | undefined {
  return safeParseWithSchema(issueDocumentRevisionSavedPayloadSchema, value)
}

export function parseIssueDocumentRevisionFinalizedPayload(value: JsonValue): IssueDocumentRevisionFinalizedPayload | undefined {
  return safeParseWithSchema(issueDocumentRevisionFinalizedPayloadSchema, value)
}

export function parseIssueDocumentDeletedPayload(value: JsonValue): IssueDocumentDeletedPayload | undefined {
  return safeParseWithSchema(issueDocumentDeletedPayloadSchema, value)
}

export function parseIssueDocumentSubtreeDeletedPayload(value: JsonValue): IssueDocumentSubtreeDeletedPayload | undefined {
  return safeParseWithSchema(issueDocumentSubtreeDeletedPayloadSchema, value)
}

export function parseIssueDocumentsClearedPayload(value: JsonValue): IssueDocumentsClearedPayload | undefined {
  return safeParseWithSchema(issueDocumentsClearedPayloadSchema, value)
}
