// Навигация по дереву структуры шифра: поиск нод, каталоги, выбор дочерней ноды по условию.

import type { Classifier, FacetConfig, StructureNode } from '@/types'
import { evaluateCondition } from './conditions'

/** Как была выбрана нода: по условию, по умолчанию, или она единственная */
export type BranchReason = 'condition' | 'default' | 'single'

export interface ChildSelection {
  node: StructureNode
  reason: BranchReason
}

export function getCatalogs(classifier: Classifier): StructureNode[] {
  return classifier.tree.children.filter((n) => n.kind === 'catalog')
}

export function getCatalog(classifier: Classifier, catalogId: string): StructureNode | null {
  return getCatalogs(classifier).find((c) => c.id === catalogId) ?? null
}

export function findNode(root: StructureNode, id: string): StructureNode | null {
  if (root.id === id) return root
  for (const child of root.children) {
    const found = findNode(child, id)
    if (found) return found
  }
  return null
}

/** Путь от корня до ноды включительно; null — если ноды нет */
export function pathToNode(root: StructureNode, id: string): StructureNode[] | null {
  if (root.id === id) return [root]
  for (const child of root.children) {
    const sub = pathToNode(child, id)
    if (sub) return [root, ...sub]
  }
  return null
}

export function facetMap(classifier: Classifier): Map<string, FacetConfig> {
  return new Map(classifier.facets.map((f) => [f.id, f]))
}

/**
 * Выбор дочерней ноды (ТЗ): значение фасета сравнивается с условиями перехода детей,
 * берётся первый подходящий; иначе — defaultChildIndex (по ТЗ — первая дочерняя нода).
 */
export function selectChild(node: StructureNode, value: string): ChildSelection | null {
  const { children } = node
  if (children.length === 0) return null
  const only = children[0]
  if (children.length === 1 && only) return { node: only, reason: 'single' }
  if (value !== '') {
    const matched = children.find((c) => c.transitionCondition && evaluateCondition(c.transitionCondition, value))
    if (matched) return { node: matched, reason: 'condition' }
  }
  const fallback = children[node.defaultChildIndex] ?? children[0]
  return fallback ? { node: fallback, reason: 'default' } : null
}

/** Все facet-ноды дерева, где используется фасет (фасет может встречаться в нескольких ветках) */
export function nodesUsingFacet(root: StructureNode, facetId: string): StructureNode[] {
  const out: StructureNode[] = []
  const visit = (n: StructureNode): void => {
    if (n.facetId === facetId) out.push(n)
    n.children.forEach(visit)
  }
  visit(root)
  return out
}

/** Каталог, которому принадлежит нода */
export function catalogOfNode(classifier: Classifier, nodeId: string): StructureNode | null {
  const path = pathToNode(classifier.tree, nodeId)
  return path?.find((n) => n.kind === 'catalog') ?? null
}
