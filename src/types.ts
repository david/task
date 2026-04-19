export type JsonPrimitive = string | number | boolean | null
export interface JsonArray extends Array<JsonValue> {}
export interface JsonObject {
  [key: string]: JsonValue
}
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export interface JsonOutputArray extends Array<JsonOutputValue> {}
export interface JsonOutputObject {
  [key: string]: JsonOutputValue | undefined
}
export type JsonOutputValue = JsonPrimitive | JsonOutputObject | JsonOutputArray

export interface StringMap<T> {
  [key: string]: T
}

export type MultiFlagValue = [string, ...string[]]
export type FlagValue = string | MultiFlagValue
export type CommandFlag = string
export interface CommandArgs {
  [flag: string]: FlagValue | undefined
}

export type FlagDef = {
  description: string
  kind: "switch" | "value"
  required: boolean
  hasDefault: boolean
  defaultValue: string
}

type CommandBase = {
  description: string
  usage: string
  flags: StringMap<FlagDef>
  examples: string[]
  run: (args: CommandArgs) => Promise<JsonOutputValue>
}

export type Command = CommandBase | (CommandBase & { positionalId: boolean })
