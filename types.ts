export type FlagDef = {
  description: string
  required?: boolean
  default?: string
}

export interface FlagMap {
  [flag: string]: FlagDef
}

export interface CommandArgs {
  [flag: string]: string | string[] | undefined
}

export interface CommandResult {
  [key: string]: unknown
}

export type Command = {
  description: string
  usage: string
  flags: FlagMap
  examples: string[]
  positionalId?: boolean
  run: (args: CommandArgs) => Promise<CommandResult>
}
