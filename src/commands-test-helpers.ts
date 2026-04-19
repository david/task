import { afterAll, beforeAll, expect } from "bun:test"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
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

function isJsonObject(value: JsonValue | object | null): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function expectJsonObject(value: JsonValue | object | null): JsonObject {
  if (!isJsonObject(value)) {
    throw new Error("Expected JSON object")
  }
  return value
}

export function readJsonObject(path: string): JsonObject {
  return expectJsonObject(JSON.parse(readFileSync(path, "utf-8")))
}

export function readCanonicalEvents(repoRoot: string, issueId: string): JsonObject[] {
  const eventDir = join(repoRoot, ".task", "events", "by-issue", issueId)
  if (!existsSync(eventDir)) {
    return []
  }

  return readdirSync(eventDir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .map((entry) => readJsonObject(join(eventDir, entry)))
}

export function expectRecordWithFields(records: ReadonlyArray<JsonObject>, expected: JsonObject): void {
  expect(
    records.some((record) =>
      Object.entries(expected).every(([key, value]) => record[key] === value)
    )
  ).toBe(true)
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
  writeFileSync(join(issueDir, "issue.json"), `${JSON.stringify(metadata, null, 2)}\n`)

  for (const [store, keys] of Object.entries(stores)) {
    const storeDir = join(issueDir, store)
    mkdirSync(storeDir, { recursive: true })
    for (const [key, content] of Object.entries(keys)) {
      writeFileSync(join(storeDir, key), content)
    }
  }
}
