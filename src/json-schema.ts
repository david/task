import { z } from "zod"
import type { ZodType } from "zod"
import type { JsonObject, JsonValue } from "./types"

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([jsonPrimitiveSchema, z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)])
)

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(z.string(), jsonValueSchema)

export function safeParseWithSchema<T>(schema: ZodType<T>, value: unknown): T | undefined {
  const result = schema.safeParse(value)
  return result.success ? result.data : undefined
}
