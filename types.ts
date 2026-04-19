export type FlagDef = {
  description: string
  required?: boolean
  default?: string
}

export type Command = {
  description: string
  usage: string
  flags: Record<string, FlagDef>
  examples: string[]
  positionalId?: boolean
  run: (args: Record<string, string | string[] | undefined>) => Promise<Record<string, unknown>>
}
