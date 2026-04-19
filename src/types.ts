export type JsonPrimitive = string | number | boolean | null
export type JsonArray = JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export type StringMap<T> = { [key: string]: T }
export type FlagValue = string | string[] | undefined
export type CommandArgs = { [flag: string]: FlagValue }

export type FlagDef = {
  description: string
  required?: boolean
  default?: string
}

export type Command = {
  description: string
  usage: string
  flags: StringMap<FlagDef>
  examples: string[]
  positionalId?: boolean
  run: (args: CommandArgs) => Promise<JsonValue>
}
