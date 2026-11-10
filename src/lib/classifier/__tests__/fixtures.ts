// Небольшие синтетические классификаторы для граничных случаев.
// Основные тесты идут на реальных мок-конфигах (src/mocks/data) — так проверяется и сам мок.

import type { Classifier, FacetConfig, StructureNode } from '@/types'

export const DRILL_VALUES: Record<string, string> = {
  'f-group': 'SV',
  'f-drill-type': '1',
  'f-material': 'H',
  'f-coating': 'A',
  'f-diameter': '6.5',
  'f-length': '57',
  'f-shank': 'C',
  'f-precision': 'H8',
  'f-coolant': '0',
  'f-standard': 'ГОСТ10902',
}

/** Шифр DRILL_VALUES, собранный вручную по правилам ТЗ (справа налево) */
export const DRILL_CODE = 'ГОСТ109020H8C-57-6.5AH1SV'

const f = (id: string, patch: Partial<FacetConfig> = {}): FacetConfig => ({
  id,
  name: id.toUpperCase(),
  lengthMode: 'fixed',
  defaultLength: 1,
  dataType: 'string',
  required: true,
  section: 's',
  ...patch,
})

const n = (id: string, facetId: string, children: StructureNode[] = [], extra: Partial<StructureNode> = {}): StructureNode => ({
  id,
  kind: 'facet',
  name: id,
  facetId,
  children,
  defaultChildIndex: 0,
  ...extra,
})

export function makeClassifier(facets: FacetConfig[], structure: StructureNode, readDirection: 'ltr' | 'rtl' = 'ltr'): Classifier {
  return {
    id: 'cls-test',
    name: 'Тест',
    readDirection,
    inputModes: ['direct'],
    sections: [{ id: 's', name: 'S', order: 1 }],
    facets,
    tree: {
      id: 'root',
      kind: 'root',
      name: 'root',
      defaultChildIndex: 0,
      children: [{ id: 'cat', kind: 'catalog', name: 'cat', defaultChildIndex: 0, children: [structure] }],
    },
  }
}

/** a(длина по умолчанию = 1) → b(fixed 2), без remainder — для проверки «лишних символов» */
export const fixedOnly = makeClassifier([f('a'), f('b', { fixedLength: 2 })], n('na', 'a', [n('nb', 'b')]))

/** a(delimiter '/') → b(remainder) */
export const delimited = makeClassifier(
  [f('a', { lengthMode: 'delimiter', delimiter: '/' }), f('b', { lengthMode: 'remainder' })],
  n('na', 'a', [n('nb', 'b')]),
)

/** Ветвление с defaultChildIndex = 1: при несовпадении условий берётся ВТОРАЯ нода */
export const branchDefault1 = makeClassifier(
  [f('a'), f('x'), f('y')],
  n(
    'na',
    'a',
    [
      n('nx', 'x', [], { transitionCondition: { type: 'string', value: 'X' } }),
      n('ny', 'y', [], { transitionCondition: { type: 'string', value: 'Y' } }),
    ],
    { defaultChildIndex: 1 },
  ),
)

/** Правила-конфликты: a и b оба переопределяют label у c; плюс «обратное» правило c → a */
export const conflicting = makeClassifier(
  [
    f('a', {
      dependencies: [{ id: 'ra', triggerFacetId: 'a', triggerValue: '1', overrides: [{ facetId: 'c', label: 'from A', visible: true }] }],
    }),
    f('b', {
      dependencies: [{ id: 'rb', triggerFacetId: 'b', triggerValue: '1', overrides: [{ facetId: 'c', label: 'from B' }] }],
    }),
    f('c', {
      dependencies: [{ id: 'rc', triggerFacetId: 'c', triggerValue: '1', overrides: [{ facetId: 'a', label: 'backward' }] }],
    }),
  ],
  n('na', 'a', [n('nb', 'b', [n('nc', 'c')])]),
)
