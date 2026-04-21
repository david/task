import { z } from "zod"
import { jsonValueSchema } from "../json-schema"
import type { JsonValue, StringMap } from "../types"

const nonEmptyStringSchema = z.string().min(1)
const eventTimestampSchema = z.string().refine((value) => Number.isFinite(Date.parse(value)), {
  message: "Invalid timestamp",
})

export const issueStatusSchema = z.enum(["open", "closed"])

type IssueMetadataFields = {
  title: string
  description: string
  status: "open" | "closed"
  phase: string
  priority: number
  created: string
  updated: string
  refs: string[]
  labels: string[]
} & ({ github_issue: number } | {})

export type IssueMetadata = IssueMetadataFields & StringMap<JsonValue | undefined>

export type IssueRecord = IssueMetadata & {
  id: string
}

export type IssueCreatedPayload = IssueMetadata & {
  issueId: string
} & ({ parentId: string } | {})

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
  savedAt: string
} & ({ supersedesRevision: number } | {})

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

type IssueDocumentRevisionSavedPayloadBase = {
  issueId: string
  path: string
  revision: number
  phase: string
  draft: boolean
  content: string
  savedAt: string
}

export type IssueDocumentRevisionSavedPayload = IssueDocumentRevisionSavedPayloadBase & ({ supersedesRevision: number } | {})

export type IssueDocumentRevisionFinalizedPayload = {
  issueId: string
  path: string
  revision: number
  phase: string
  finalizedAt: string
}

export type IssueDocumentDeletedPayload = {
  issueId: string
  path: string
  deletedAt: string
}

export type IssueDocumentSubtreeDeletedPayload = {
  issueId: string
  pathPrefix: string
  deletedAt: string
}

export type IssueDocumentsClearedPayload = {
  issueId: string
  deletedAt: string
}

export type StoredEventFile = {
  id: string
  type: string
  tags: string[]
  payload: JsonValue
  position: string
  timestamp: string
}

type LegacyIssueFileFields = {
  title: string
  status: "open" | "closed"
  phase: string
} & ({ description: string } | {})
  & ({ priority: number } | {})
  & ({ created: string } | {})
  & ({ updated: string } | {})
  & ({ refs: string[] } | {})
  & ({ labels: string[] } | {})
  & ({ github_issue: number } | {})

export type LegacyIssueFile = LegacyIssueFileFields & StringMap<JsonValue | undefined>

const issueMetadataObjectSchema = z.object({
  title: z.string(),
  description: z.string(),
  status: issueStatusSchema,
  phase: nonEmptyStringSchema,
  priority: z.number(),
  created: nonEmptyStringSchema,
  updated: nonEmptyStringSchema,
  refs: z.array(z.string()),
  labels: z.array(z.string()),
  github_issue: z.number().optional(),
})

export const issueMetadataSchema: z.ZodType<IssueMetadata> = issueMetadataObjectSchema.catchall(jsonValueSchema)

export const issueRecordSchema: z.ZodType<IssueRecord> = issueMetadataObjectSchema
  .extend({ id: nonEmptyStringSchema })
  .catchall(jsonValueSchema)

export const issueCreatedPayloadSchema: z.ZodType<IssueCreatedPayload> = z.object({
  title: z.string(),
  description: z.string(),
  status: issueStatusSchema,
  phase: nonEmptyStringSchema,
  priority: z.number(),
  created: nonEmptyStringSchema,
  updated: nonEmptyStringSchema,
  refs: z.array(z.string()),
  labels: z.array(z.string()),
  github_issue: z.number().optional(),
  issueId: nonEmptyStringSchema,
  parentId: nonEmptyStringSchema.optional(),
}).catchall(jsonValueSchema)

export const issuePhaseChangedPayloadSchema: z.ZodType<IssuePhaseChangedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  from: nonEmptyStringSchema,
  to: nonEmptyStringSchema,
  changedAt: eventTimestampSchema,
})

export const issueMetadataSetPayloadSchema: z.ZodType<IssueMetadataSetPayload> = z.object({
  issueId: nonEmptyStringSchema,
  key: nonEmptyStringSchema,
  value: jsonValueSchema,
  updatedAt: eventTimestampSchema,
})

export const issueLabelsChangedPayloadSchema: z.ZodType<IssueLabelsChangedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  added: z.array(z.string()),
  removed: z.array(z.string()),
  updatedAt: eventTimestampSchema,
})

export const issueRefsChangedPayloadSchema: z.ZodType<IssueRefsChangedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  added: z.array(z.string()),
  removed: z.array(z.string()),
  updatedAt: eventTimestampSchema,
})

export const issueClosedPayloadSchema: z.ZodType<IssueClosedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  closedAt: eventTimestampSchema,
})

export const storeRevisionSavedPayloadSchema: z.ZodType<StoreRevisionSavedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  store: nonEmptyStringSchema,
  key: nonEmptyStringSchema,
  revision: z.number(),
  phase: nonEmptyStringSchema,
  draft: z.boolean(),
  content: z.string(),
  savedAt: eventTimestampSchema,
  supersedesRevision: z.number().optional(),
})

export const storeRevisionFinalizedPayloadSchema: z.ZodType<StoreRevisionFinalizedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  store: nonEmptyStringSchema,
  key: nonEmptyStringSchema,
  revision: z.number(),
  phase: nonEmptyStringSchema,
  finalizedAt: eventTimestampSchema,
})

export const storeEntryDeletedPayloadSchema: z.ZodType<StoreEntryDeletedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  store: nonEmptyStringSchema,
  key: nonEmptyStringSchema,
  deletedAt: eventTimestampSchema,
})

export const storeDeletedPayloadSchema: z.ZodType<StoreDeletedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  store: nonEmptyStringSchema,
  deletedAt: eventTimestampSchema,
})

export const issueDocumentRevisionSavedPayloadSchema: z.ZodType<IssueDocumentRevisionSavedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  path: nonEmptyStringSchema,
  revision: z.number(),
  phase: nonEmptyStringSchema,
  draft: z.boolean(),
  content: z.string(),
  savedAt: eventTimestampSchema,
  supersedesRevision: z.number().optional(),
})

export const issueDocumentRevisionFinalizedPayloadSchema: z.ZodType<IssueDocumentRevisionFinalizedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  path: nonEmptyStringSchema,
  revision: z.number(),
  phase: nonEmptyStringSchema,
  finalizedAt: eventTimestampSchema,
})

export const issueDocumentDeletedPayloadSchema: z.ZodType<IssueDocumentDeletedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  path: nonEmptyStringSchema,
  deletedAt: eventTimestampSchema,
})

export const issueDocumentSubtreeDeletedPayloadSchema: z.ZodType<IssueDocumentSubtreeDeletedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  pathPrefix: nonEmptyStringSchema,
  deletedAt: eventTimestampSchema,
})

export const issueDocumentsClearedPayloadSchema: z.ZodType<IssueDocumentsClearedPayload> = z.object({
  issueId: nonEmptyStringSchema,
  deletedAt: eventTimestampSchema,
})

export const trackerStoredEventSchema = z.object({
  id: nonEmptyStringSchema,
  type: nonEmptyStringSchema,
  tags: z.array(z.string()),
  payload: jsonValueSchema,
  position: z.bigint(),
  timestamp: z.date(),
})

export const storedEventFileSchema: z.ZodType<StoredEventFile> = z.object({
  id: nonEmptyStringSchema,
  type: nonEmptyStringSchema,
  tags: z.array(z.string()),
  payload: jsonValueSchema,
  position: z.string().regex(/^-?\d+$/),
  timestamp: eventTimestampSchema,
})

export const legacyIssueFileSchema: z.ZodType<LegacyIssueFile> = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: issueStatusSchema,
  phase: nonEmptyStringSchema,
  priority: z.number().optional(),
  created: z.string().optional(),
  updated: z.string().optional(),
  refs: z.array(z.string()).optional(),
  labels: z.array(z.string()).optional(),
  github_issue: z.number().optional(),
}).catchall(jsonValueSchema)
