// Переход в произвольную ноду дерева: подобрать значения родительских фасетов,
// при которых путь структуры пройдёт через выбранную ноду.

import type { Classifier } from '@/types'
import { sampleValue, evaluateCondition } from './conditions'
import { pathToNode } from './structure'

export interface NavigationResult {
  catalogId: string
  values: Record<string, string>
  /** Фасет выбранной ноды — на него ставится фокус */
  focusFacetId: string | null
}

export function valuesForNode(
  classifier: Classifier,
  nodeId: string,
  current: Readonly<Record<string, string>>,
): NavigationResult | null {
  const path = pathToNode(classifier.tree, nodeId)
  const catalog = path?.find((n) => n.kind === 'catalog')
  if (!path || !catalog) return null

  const values: Record<string, string> = { ...current }
  for (let i = 0; i < path.length - 1; i++) {
    const parent = path[i]
    const child = path[i + 1]
    if (!parent?.facetId || !child?.transitionCondition) continue
    const v = values[parent.facetId] ?? ''
    // Текущее значение уже ведёт в нужную ветку — не трогаем
    if (!evaluateCondition(child.transitionCondition, v)) values[parent.facetId] = sampleValue(child.transitionCondition)
  }
  const target = path[path.length - 1]
  return { catalogId: catalog.id, values, focusFacetId: target?.facetId ?? null }
}
