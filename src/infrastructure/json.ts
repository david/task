import { readFileSync } from "node:fs"
import type { ZodType } from "zod"

export function parseJsonText<T>(
  text: string,
  schema: ZodType<T>,
  invalidJsonMessage: string,
  invalidValueMessage: string,
): T {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error(invalidJsonMessage)
  }

  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(invalidValueMessage)
  }

  return result.data
}

export function readJsonFile<T>(
  path: string,
  schema: ZodType<T>,
  invalidJsonMessage: string,
  invalidValueMessage: string,
): T {
  return parseJsonText(readFileSync(path, "utf-8"), schema, invalidJsonMessage, invalidValueMessage)
}
