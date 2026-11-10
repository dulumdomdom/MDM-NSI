// Редактирование конфигурации классификатора: неизменяемые операции над деревом и проверка целостности.
// Все функции возвращают НОВЫЕ объекты — удобно для черновика и отмены.

import type { Classifier, FacetConfig, StructureNode } from '@/types'
import { uniqueId } from '@/lib/ids'
import { validateRules } from './dependencies'

/* ------------------------------- дерево ------------------------------- */

export function allNodeIds(root: StructureNode): string[] {
  return [root.id, ...root.children.flatMap(allNodeIds)]
}

export function updateNode(root: StructureNode, id: string, patch: (n: StructureNode) => StructureNode): StructureNode {
  if (root.id === id) return patch(root)
  return { ...root, children: root.children.map((c) => updateNode(c, id, patch)) }
}

export function addChild(root: StructureNode, parentId: string, child: StructureNode): StructureNode {
  return updateNode(root, parentId, (n) => ({ ...n, children: [...n.children, child] }))
}

/** Удалить ноду со всем поддеревом. Корень удалить нельзя */
export function removeNode(root: StructureNode, id: string): StructureNode {
  const children = root.children.filter((c) => c.id !== id).map((c) => removeNode(c, id))
  // Индекс ветки по умолчанию не должен выйти за границы
  const defaultChildIndex = Math.min(root.defaultChildIndex, Math.max(0, children.length - 1))
  return { ...root, children, defaultChildIndex }
}

/** Новая facet-нода с уникальным id */
export function newFacetNode(c: Classifier, facetId: string): StructureNode {
  const facet = c.facets.find((f) => f.id === facetId)
  return {
    id: uniqueId('n', facet?.name ?? facetId, allNodeIds(c.tree)),
    kind: 'facet',
    name: facet?.name ?? facetId,
    facetId,
    children: [],
    defaultChildIndex: 0,
  }
}

/** Новый каталог классификатора */
export function newCatalogNode(c: Classifier, name: string): StructureNode {
  return { id: uniqueId('cat', name, allNodeIds(c.tree)), kind: 'catalog', name, children: [], defaultChildIndex: 0, decodeStructures: [] }
}

/** Новый фасет со значениями по умолчанию из ТЗ (длина 1, строка) */
export function newFacet(c: Classifier, name: string): FacetConfig {
  return {
    id: uniqueId('f', name, c.facets.map((f) => f.id)),
    name,
    lengthMode: 'fixed',
    fixedLength: 1,
    defaultLength: 1,
    dataType: 'string',
    required: true,
    section: c.sections[0]?.id ?? '',
  }
}

/** Пустой классификатор: корень + один каталог */
export function newClassifier(id: string, name: string): Classifier {
  return {
    id,
    name,
    readDirection: 'rtl',
    inputModes: ['wizard', 'direct'],
    sections: [{ id: 's-main', name: 'Основные', order: 1 }],
    facets: [],
    tree: {
      id: 'root',
      kind: 'root',
      name,
      defaultChildIndex: 0,
      children: [{ id: 'cat-main', kind: 'catalog', name: 'Основной каталог', children: [], defaultChildIndex: 0, decodeStructures: [] }],
    },
  }
}

/** Сколько нод дерева используют фасет (удалять используемый фасет нельзя) */
export function facetUsage(c: Classifier, facetId: string): number {
  return allNodeIds(c.tree).length - allNodeIds(stripFacet(c.tree, facetId)).length
}

function stripFacet(root: StructureNode, facetId: string): StructureNode {
  return { ...root, children: root.children.filter((n) => n.facetId !== facetId).map((n) => stripFacet(n, facetId)) }
}

/* ------------------------------ проверка ------------------------------ */

export interface ConfigIssue {
  where: string
  message: string
}

export function validateClassifier(c: Classifier): ConfigIssue[] {
  const issues: ConfigIssue[] = []
  const add = (where: string, message: string) => issues.push({ where, message })

  if (!c.name.trim()) add('Классификатор', 'Не задано наименование')
  if (c.inputModes.length === 0) add('Классификатор', 'Не выбран ни один режим ввода')

  const facetIds = new Set<string>()
  for (const f of c.facets) {
    if (facetIds.has(f.id)) add(`Фасет ${f.name}`, 'Повторяется id')
    facetIds.add(f.id)
    if (!f.name.trim()) add(`Фасет ${f.id}`, 'Не задано наименование')
    if (f.lengthMode === 'fixed' && (f.fixedLength ?? f.defaultLength) < 1) add(`Фасет ${f.name}`, 'Длина должна быть ≥ 1')
    if (f.lengthMode === 'delimiter' && !f.delimiter) add(`Фасет ${f.name}`, 'Не задан символ окончания')
    if (!c.sections.some((s) => s.id === f.section)) add(`Фасет ${f.name}`, 'Не выбран смысловой блок')
  }

  const nodeIds = allNodeIds(c.tree)
  if (new Set(nodeIds).size !== nodeIds.length) add('Структура', 'Повторяются id нод')
  if (!c.tree.children.some((n) => n.kind === 'catalog')) add('Структура', 'Нет ни одного каталога')

  const visit = (n: StructureNode, path: string): void => {
    if (n.kind === 'facet' && (!n.facetId || !facetIds.has(n.facetId))) add(path, 'Нода ссылается на несуществующий фасет')
    if (n.children.length > 1 && !n.children[n.defaultChildIndex]) add(path, 'Неверная ветка по умолчанию')
    // Остаток шифра может забирать только последний фасет ветки
    const facet = c.facets.find((f) => f.id === n.facetId)
    if (facet?.lengthMode === 'remainder' && n.children.length > 0) add(path, `«${facet.name}» забирает остаток шифра, после него фасетов быть не может`)
    for (const d of n.decodeStructures ?? []) {
      for (const p of d.parts) if (p.kind === 'facet' && !facetIds.has(p.facetId)) add(`${path} / расшифровка «${d.name}»`, `Неизвестный фасет ${p.facetId}`)
    }
    n.children.forEach((ch) => visit(ch, `${path} → ${ch.name}`))
  }
  visit(c.tree, c.tree.name)

  for (const r of validateRules(c)) add(`Правило ${r.ruleId}`, r.message)
  return issues
}
