declare module "bun:test" {
  type MockedFunction<T extends (...args: any[]) => any> = T & {
    mock: {
      calls: unknown[][]
    }
  }

  interface ExpectFn {
    (actual: unknown): any
    any(expected: unknown): unknown
    arrayContaining(expected: unknown[]): unknown
  }

  export const describe: (name: string, fn: () => unknown) => void
  export const test: (name: string, fn: () => unknown) => void
  export const beforeAll: (fn: () => unknown) => void
  export const afterAll: (fn: () => unknown) => void
  export const beforeEach: (fn: () => unknown) => void
  export const afterEach: (fn: () => unknown) => void
  export const expect: ExpectFn
  export const mock: <T extends (...args: any[]) => any>(fn?: T) => MockedFunction<T>
}

declare const Bun: {
  spawnSync(
    argv: string[],
    options?: {
      cwd?: string
    }
  ): {
    exitCode: number
    stdout: Uint8Array
    stderr: Uint8Array
  }
  sleep(ms: number): Promise<void>
}

interface ImportMeta {
  dir: string
}
