import { afterAll, beforeAll, expect } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readJsonFile } from "./infrastructure/json"
import { jsonObjectSchema } from "./json-schema"
import {
  issueMetadataSchema,
  legacyIssueFileSchema,
  storedEventFileSchema,
  type IssueMetadata,
  type LegacyIssueFile,
  type StoredEventFile,
} from "./tracker/events"
import type { JsonObject, JsonValue, StringMap } from "./types"

export function useTempRoot(prefix: string): () => string {
  let root = ""

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), prefix))
  })

  afterAll(() => {
    if (root !== "") {
      rmSync(root, { recursive: true, force: true })
    }
  })

  return () => root
}

export function issueProjectionRoot(repoRoot: string): string {
  return join(repoRoot, ".task", "issues")
}

export function writeTaskSettings(
  repoRoot: string,
  settings: { defaultPhase: string; phases: string[]; transitions: StringMap<string[]> }
): void {
  mkdirSync(join(repoRoot, ".task"), { recursive: true })
  writeFileSync(join(repoRoot, ".task", "settings.json"), `${JSON.stringify(settings, null, 2)}\n`)
}

export function fakeStdin(content: string): () => Promise<string> {
  return () => Promise.resolve(content)
}

export function expectJsonObject(value: JsonValue): JsonObject {
  const parsed = jsonObjectSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error("Expected JSON object")
  }
  return parsed.data
}

export function readJsonObject(path: string): JsonObject {
  return readJsonFile(path, jsonObjectSchema, `${path} is not valid JSON`, `Invalid JSON object at '${path}'`)
}

export function readIssueMetadata(path: string): IssueMetadata {
  return readJsonFile(path, issueMetadataSchema, `${path} is not valid JSON`, `Invalid issue metadata at '${path}'`)
}

export function readStoredEvent(path: string): StoredEventFile {
  return readJsonFile(path, storedEventFileSchema, `${path} is not valid JSON`, `Invalid stored event file '${path}'`)
}

export function readCanonicalEvents(repoRoot: string, issueId: string): StoredEventFile[] {
  const eventDir = join(repoRoot, ".task", "events", "by-issue", issueId)
  if (!existsSync(eventDir)) {
    return []
  }

  return readdirSync(eventDir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => readStoredEvent(join(eventDir, entry)))
}

export function expectRecordWithFields(records: ReadonlyArray<JsonObject>, expected: JsonObject): void {
  expect(
    records.some((record) =>
      Object.entries(expected).every(([key, value]) => record[key] === value)
    )
  ).toBe(true)
}

function normalizeLegacyMetadata(metadata: JsonObject): LegacyIssueFile {
  const parsed = legacyIssueFileSchema.safeParse(metadata)
  if (!parsed.success) {
    throw new Error("Invalid legacy issue test fixture")
  }
  return parsed.data
}

export function writeLegacyIssue(
  legacyRoot: string,
  issueId: string,
  metadata: JsonObject,
  stores: StringMap<StringMap<string>> = {},
  archived = false
): void {
  const issueDir = archived
    ? join(legacyRoot, ".archive", issueId)
    : join(legacyRoot, issueId)

  mkdirSync(issueDir, { recursive: true })
  writeFileSync(join(issueDir, "issue.json"), `${JSON.stringify(normalizeLegacyMetadata(metadata), null, 2)}\n`)

  for (const [store, keys] of Object.entries(stores)) {
    const storeDir = join(issueDir, store)
    mkdirSync(storeDir, { recursive: true })
    for (const [key, content] of Object.entries(keys)) {
      writeFileSync(join(storeDir, key), content)
    }
  }
}
