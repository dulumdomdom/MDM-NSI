// Маршрут заявки по группам справочника: строка обходного листа с groupIds действует только для позиций
// из этих групп (с подгруппами). Одни и те же функции — у «сервера» и у подсказки маршрута в интерфейсе.

import type { CatalogElement, RequestStep } from '@/types'

/** Группа и все её родители */
export function groupChain(startId: string | null | undefined, elements: readonly Pick<CatalogElement, 'id' | 'parentId'>[]): Set<string> {
  const byId = new Map(elements.map((e) => [e.id, e]))
  const chain = new Set<string>()
  let cursor = startId ?? undefined
  while (cursor && !chain.has(cursor)) {
    chain.add(cursor)
    cursor = byId.get(cursor)?.parentId
  }
  return chain
}

/** Нужна ли строка позиции: ограничения по группам нет или позиция внутри одной из групп */
export const stepApplies = (step: Pick<RequestStep, 'groupIds'>, chain: ReadonlySet<string>): boolean =>
  !step.groupIds?.length || step.groupIds.some((g) => chain.has(g))
