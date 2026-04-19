export type JsonPrimitive = string | number | boolean | null
export type JsonArray = JsonValue[]
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonObject | JsonArray

export type StringMap<T> = { [key: string]: T }
export type FlagValue = string | string[] | undefined
export type CommandArgs = { [flag: string]: FlagValue }

export type FlagDef =
  | { description: string }
  | { description: string; required: boolean }
  | { description: string; default: string }
  | { description: string; required: boolean; default: string }

type CommandBase = {
  description: string
  usage: string
  flags: StringMap<FlagDef>
  examples: string[]
  run: (args: CommandArgs) => Promise<JsonValue>
}

export type Command = CommandBase | (CommandBase & { positionalId: boolean })
