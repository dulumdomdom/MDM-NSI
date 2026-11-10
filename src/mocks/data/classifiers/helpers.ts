// Помощники для компактного описания деревьев в моках. Результат — строго типы из src/types.

import type { StructureNode, TransitionCondition } from '@/types'

/** Facet-нода */
export function facetNode(
  id: string,
  facetId: string,
  children: StructureNode[] = [],
  transitionCondition?: TransitionCondition,
): StructureNode {
  return {
    id,
    kind: 'facet',
    name: id,
    facetId,
    children,
    defaultChildIndex: 0,
    ...(transitionCondition ? { transitionCondition } : {}),
  }
}

/**
 * Линейная цепочка facet-нод: [a, b, c] → a → b → c.
 * id нод: `${prefix}-${facetId}`. tail — дети последней ноды (ветвление).
 */
export function chain(
  prefix: string,
  facetIds: string[],
  tail: StructureNode[] = [],
  firstCondition?: TransitionCondition,
): StructureNode {
  const [first, ...rest] = facetIds
  if (first === undefined) throw new Error('chain: пустой список фасетов')
  const children = rest.length > 0 ? [chain(prefix, rest, tail)] : tail
  return facetNode(`${prefix}-${first}`, first, children, firstCondition)
}
