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
  run: (args: Record<string, string | string[] | undefined>) => Promise<object>
}
