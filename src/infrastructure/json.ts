import { readFileSync } from "node:fs"
import type { ZodType } from "zod"

export function parseJsonText<T>(
  text: string,
  schema: ZodType<T>,
  invalidJsonMessage: string,
  invalidValueMessage: string,
): T {
  let result: ReturnType<ZodType<T>["safeParse"]>
  try {
    result = schema.safeParse(JSON.parse(text))
  } catch {
    throw new Error(invalidJsonMessage)
  }

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
