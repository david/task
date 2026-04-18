import { rebuildHierarchyIndex } from "./projections"

export async function materializeHierarchyLink(
  root: string,
  _childId: string,
  _parentId: string | undefined
): Promise<void> {
  await rebuildHierarchyIndex(root)
}

export async function listHierarchyChildren(
  root: string,
  parentId: string,
  _includeClosed: boolean
): Promise<string[]> {
  const index = await rebuildHierarchyIndex(root)
  return [...(index.childrenByParent[parentId] ?? [])]
}

export async function listHierarchyParents(root: string, childId: string): Promise<string[]> {
  const index = await rebuildHierarchyIndex(root)
  return [...(index.parentsByChild[childId] ?? [])]
}
