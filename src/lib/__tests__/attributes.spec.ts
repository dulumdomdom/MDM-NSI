import { describe, expect, it } from 'vitest'
import type { CatalogAttribute } from '@/types'
import { attributeKind, defaultValue, formatAttribute, validateAll, validateAttribute } from '../attributes'

const address: CatalogAttribute = {
  id: 'address',
  name: 'Адрес',
  type: 'composite',
  required: true,
  compositeFields: [
    { id: 'city', name: 'Город', type: 'string', required: true },
    { id: 'house', name: 'Дом', type: 'string', required: false },
  ],
}

describe('атрибуты', () => {
  it('6 UI-групп для 7 типов', () => {
    expect(new Set((['int', 'float', 'string', 'datetime', 'blob', 'composite', 'reference'] as const).map(attributeKind)).size).toBe(6)
  })

  it('составной: значение по умолчанию и вложенные ошибки', () => {
    expect(defaultValue(address)).toEqual({ city: null, house: null })
    expect(validateAttribute(address, { city: '', house: '1' })).toEqual({ 'address.city': 'Обязательное поле' })
    expect(formatAttribute(address, { city: 'Москва', house: '7' })).toBe('Москва, 7')
  })

  it('числа, строки, ссылки', () => {
    const int: CatalogAttribute = { id: 'n', name: 'N', type: 'int', required: true, min: 1 }
    expect(validateAttribute(int, 1.5)).toEqual({ n: 'Ожидается целое число' })
    expect(validateAttribute(int, 0)).toEqual({ n: 'Не меньше 1' })
    const inn: CatalogAttribute = { id: 'inn', name: 'ИНН', type: 'string', required: true, pattern: '^\\d{10}$' }
    expect(validateAll([inn], { inn: '123' })).toEqual({ inn: 'Неверный формат' })
    const ref: CatalogAttribute = { id: 'u', name: 'Ед', type: 'reference', required: true, referenceCatalogId: 'x' }
    expect(validateAttribute(ref, null)).toEqual({ u: 'Обязательное поле' })
    expect(formatAttribute(ref, { catalogId: 'x', elementId: '1', display: 'кг' })).toBe('кг')
  })
})
