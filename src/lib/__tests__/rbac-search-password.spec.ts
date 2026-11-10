import { describe, expect, it } from 'vitest'
import type { CatalogElement, PasswordPolicy, Role } from '@/types'
import { can, canAccessColumn, canAccessRow, filterColumns, filterRows } from '../rbac'
import { fuzzyMatch, levenshtein, maskToRegExp, matchesSearch, searchItems } from '../search'
import { hashPassword, isPasswordExpired, isPasswordReused, validatePassword } from '../security/password'

const engineer: Role = {
  id: 'r',
  name: 'Инженер',
  permissions: [
    {
      resource: 'catalog',
      resourceId: 'cat-a',
      actions: ['read', 'create'],
      columnIds: ['name', 'unit'],
      rowFilter: { all: [{ field: '$state', op: 'in', value: ['active'] }] },
    },
  ],
}
const admin: Role = { id: 'a', name: 'Админ', permissions: [{ resource: 'catalog', resourceId: '*', actions: ['read', 'update'], columnIds: '*' }] }

const el = (id: string, state: string): CatalogElement => ({
  id,
  catalogId: 'cat-a',
  state,
  attributes: { name: `Эл ${id}`, unit: { catalogId: 'u', elementId: 'kg', display: 'кг' }, price: 10 },
  history: [],
})

describe('RBAC', () => {
  it('колонки: только разрешённые', () => {
    expect(canAccessColumn([engineer], 'cat-a', 'name')).toBe(true)
    expect(canAccessColumn([engineer], 'cat-a', 'price')).toBe(false)
    expect(filterColumns([engineer], 'cat-a', [{ id: 'name' }, { id: 'price' }]).map((c) => c.id)).toEqual(['name'])
  })

  it('строки: фильтр по состоянию и вырезание значений скрытых колонок', () => {
    const rows = filterRows([engineer], 'cat-a', [el('1', 'active'), el('2', 'draft')])
    expect(rows.map((r) => r.id)).toEqual(['1'])
    expect(rows[0]?.attributes).not.toHaveProperty('price')
    expect(canAccessRow([engineer], 'cat-a', el('2', 'draft'))).toBe(false)
  })

  it('объединение ролей и wildcard', () => {
    expect(filterRows([engineer, admin], 'cat-a', [el('2', 'draft')])[0]?.attributes).toHaveProperty('price')
    expect(can([engineer], 'catalog', 'cat-a', 'update')).toBe(false)
    expect(can([admin], 'catalog', 'any', 'update')).toBe(true)
    expect(canAccessColumn([], 'cat-a', 'name')).toBe(false)
  })
})

describe('поиск', () => {
  it('контекстный: подстрока без учёта регистра и ё', () => {
    expect(matchesSearch('Ёлочный шар', 'елоч', 'context')).toBe(true)
    expect(matchesSearch('Сверло', 'фреза', 'context')).toBe(false)
  })

  it('неточный: опечатки', () => {
    expect(levenshtein('сверло', 'свирло')).toBe(1)
    expect(fuzzyMatch('Сверло спиральное', 'свирло')).toBe(true)
    expect(fuzzyMatch('Сверло спиральное', 'молоток')).toBe(false)
  })

  it('по маске: * и ?, спецсимволы экранируются', () => {
    expect(maskToRegExp('СВ*-?').test('СВ12-5')).toBe(true)
    expect(matchesSearch('a.b', 'a.b', 'mask')).toBe(true)
    expect(matchesSearch('axb', 'a.b', 'mask')).toBe(false)
  })

  it('searchItems: пустой запрос возвращает всё', () => {
    const items = ['a', 'b']
    expect(searchItems(items, (x) => [x], ' ', 'context')).toEqual(items)
  })
})

describe('пароли', () => {
  const policy: PasswordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireDigits: true,
    requireSpecial: true,
    maxAgeDays: 90,
    uniqueHistoryCount: 3,
  }

  it('SHA-512 + соль совпадает с эталоном (node:crypto)', async () => {
    expect(await hashPassword('admin', 'a1f3c9e2')).toBe(
      '1b0dd4d66ba175982df63450b22a8ec6b6fe214554bc4ce74e2f6752ae884e3c9b867227bb189a505ecd810d19abdda79f11bb9523f97d6a92931249b8a7aaa2',
    )
  })

  it('политика сложности', () => {
    expect(validatePassword('abc', policy).length).toBe(4)
    expect(validatePassword('Пароль-2024', policy)).toEqual([])
  })

  it('срок действия и уникальность', () => {
    expect(isPasswordExpired('2020-01-01T00:00:00Z', policy, new Date('2020-05-01'))).toBe(true)
    expect(isPasswordExpired('2020-01-01T00:00:00Z', { ...policy, maxAgeDays: 0 })).toBe(false)
    expect(isPasswordReused('h3', ['h1', 'h2', 'h3'], policy)).toBe(true)
    expect(isPasswordReused('h1', ['h1', 'h2', 'h3', 'h4'], policy)).toBe(false)
  })
})
