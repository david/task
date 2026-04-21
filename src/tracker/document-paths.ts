const DOCUMENT_SEGMENT_RE = /^[A-Za-z0-9_-]+$/

export type DocumentSelector =
  | { kind: "exact"; path: string }
  | { kind: "subtree"; path: string }
  | { kind: "root" }

function validateDocumentPathOrThrow(value: string): string {
  if (value.length === 0 || value === "/" || value.startsWith("/") || value.endsWith("/")) {
    throw new Error(`Invalid document key '${value}'`)
  }

  const segments = value.split("/")
  if (segments.some((segment) => segment.length === 0 || !DOCUMENT_SEGMENT_RE.test(segment))) {
    throw new Error(`Invalid document key '${value}'`)
  }

  return value
}

export function parseExactDocumentPath(value: string): string {
  if (value === "/") {
    throw new Error("Root selector '/' is not allowed here")
  }
  if (value.endsWith("/")) {
    throw new Error(`Subtree selector '${value}' is not allowed here`)
  }
  return validateDocumentPathOrThrow(value)
}

export function parseDocumentSelector(value: string): DocumentSelector {
  if (value === "/") {
    return { kind: "root" }
  }

  if (value.endsWith("/")) {
    const path = value.slice(0, -1)
    return { kind: "subtree", path: validateDocumentPathOrThrow(path) }
  }

  return { kind: "exact", path: validateDocumentPathOrThrow(value) }
}

export function joinLegacyStorePath(store: string, key: string): string {
  return `${store}/${key}`
}

export function splitDocumentPath(path: string): string[] {
  return path.split("/")
}

export function isPathWithinPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}
