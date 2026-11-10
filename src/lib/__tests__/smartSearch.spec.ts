import { describe, expect, it } from 'vitest'
import type { CatalogAttribute, ReferenceValue } from '@/types'
import { draftFromQuery, normalizeForSearch, parseQuery, smartSearch, tokenize, type SearchField } from '../smartSearch'
import { canDecideStep, canSeeRequest } from '../rbac'

const attrs: CatalogAttribute[] = [
  { id: 'name', name: 'Наименование', type: 'string', required: true },
  { id: 'article', name: 'Артикул', type: 'string', required: true },
  { id: 'unit', name: 'Ед. изм.', type: 'reference', required: true, referenceCatalogId: 'u' },
  { id: 'price', name: 'Цена', type: 'float', required: false },
]

interface Row {
  id: string
  name: string
  article: string
  code?: string
}
const rows: Row[] = [
  { id: '1', name: 'Болт M12x50 оцинкованный 8.8', article: 'BT-12-50' },
  { id: '2', name: 'Болт M10x40', article: 'BT-10-40' },
  { id: '3', name: 'Сверло спиральное Ø6.5×57 твёрдый сплав', article: 'SV-6.5-H', code: 'ГОСТ109020H8C-57-6.5AH1SV' },
  { id: '4', name: 'Гайка М12 оцинкованная', article: 'GK-12' },
]
const fields = (r: Row): SearchField[] => [
  { id: 'name', label: 'Наименование', text: r.name, weight: 1 },
  { id: 'article', label: 'Артикул', text: r.article, weight: 0.9 },
  ...(r.code ? [{ id: 'code', label: 'Шифр', text: r.code, weight: 1 }] : []),
]
const search = (q: string) => smartSearch(rows, fields, parseQuery(q, attrs))

describe('умный поиск', () => {
  it('нормализация: кириллица/латиница, х в размерах, запятая', () => {
    expect(normalizeForSearch('М12х50')).toBe(normalizeForSearch('M12x50'))
    expect(tokenize('Сверло 6,5')).toContain('6.5')
    expect(tokenize('M12 х 50')).toEqual(expect.arrayContaining(['m12x50', 'm12', '50']))
  })

  it('кириллическая «М» и «х» находят латинское написание, лучший — первым', () => {
    const hits = search('болт М12х50')
    expect(hits[0]?.item.id).toBe('1')
    expect(hits.map((h) => h.item.id)).not.toContain('3')
  })

  it('сокращения и опечатки', () => {
    expect(search('болт оцинк')[0]?.item.id).toBe('1')
    expect(search('свирло спиральное')[0]?.item.id).toBe('3')
  })

  it('поиск по свойству ограничен своим атрибутом', () => {
    const hits = search('Артикул: GK-12')
    expect(hits[0]?.item.id).toBe('4')
    expect(hits[0]?.matched.every((m) => m.fieldId === 'article')).toBe(true)
  })

  it('поиск по шифру', () => {
    expect(search('ГОСТ109020H8C-57-6.5AH1SV')[0]?.item.id).toBe('3')
  })

  it('ничего похожего — пусто', () => {
    expect(search('кронштейн настенный')).toEqual([])
  })
})

describe('черновик элемента из запроса', () => {
  const units: ReferenceValue[] = [
    { catalogId: 'u', elementId: 'u-pcs', display: 'шт' },
    { catalogId: 'u', elementId: 'u-kg', display: 'кг' },
  ]

  it('свойства, неявная ссылка и наименование', () => {
    const d = draftFromQuery('Кронштейн настенный 200 мм, шт; Артикул: KR-200; Цена: 1 250,50', attrs, 'name', { unit: units })
    expect(d.values['name']).toBe('Кронштейн настенный 200 мм')
    expect(d.values['article']).toBe('KR-200')
    expect(d.values['price']).toBe(1250.5)
    expect(d.values['unit']).toEqual(units[0])
    expect(d.filled.sort()).toEqual(['article', 'name', 'price', 'unit'])
  })

  it('свойство с опечаткой в названии атрибута', () => {
    expect(parseQuery('Артикл: X-1', attrs).properties[0]?.attributeId).toBe('article')
  })
})

describe('строки шифрования в обходном листе', () => {
  const req = {
    id: 'r',
    title: '',
    targetType: 'catalog-element' as const,
    targetId: 'cat-a',
    payload: {},
    status: 'in_review' as const,
    sequential: false,
    createdBy: 'author',
    createdAt: '',
    steps: [
      { id: 's1', order: 1, kind: 'encode' as const, name: '', roleId: 'mod', classifierId: 'cls-x', attributeIds: [], status: 'pending' as const },
      { id: 's2', order: 2, kind: 'encode' as const, name: '', roleId: 'mod', classifierId: 'cls-y', attributeIds: [], status: 'pending' as const },
    ],
  }
  const modX = [{ roleId: 'mod', scope: { type: 'classifier' as const, id: 'cls-x' } }]

  it('модератор классификатора берёт только свою строку', () => {
    expect(canDecideStep(modX, req, req.steps[0]!)).toBe(true)
    expect(canDecideStep(modX, req, req.steps[1]!)).toBe(false)
  })

  it('заявку видят автор, ответственные и администратор', () => {
    expect(canSeeRequest(modX, 'm', req)).toBe(true)
    expect(canSeeRequest([], 'author', req)).toBe(true)
    expect(canSeeRequest([{ roleId: 'mod', scope: { type: 'classifier', id: 'cls-z' } }], 'other', req)).toBe(false)
  })
})

describe('строгий режим «все слова» (фильтр таблиц)', () => {
  const strict = (q: string) => smartSearch(rows, fields, parseQuery(q, attrs), { requireAll: true, limit: Infinity }).map((h) => h.item.id)

  it('порядок слов, латиница/кириллица, начала слов', () => {
    expect(strict('м12 болт')).toEqual(['1'])
    expect(strict('болт M12x50 оцинк')).toEqual(['1'])
    expect(strict('оцинк')).toEqual(expect.arrayContaining(['1', '4']))
  })

  it('знак диаметра и запятая; число из обозначения', () => {
    expect(strict('сверло 6,5')).toEqual(['3'])
    expect(strict('гайка 12')).toEqual(['4'])
  })

  it('все слова обязательны, опечатки не допускаются', () => {
    expect(strict('болт кронштейн')).toEqual([])
    expect(strict('свирло')).toEqual([])
  })

  it('шифр', () => {
    expect(strict('ГОСТ109020H8C-57-6.5AH1SV')).toEqual(['3'])
  })
})
