import { describe, expect, it } from 'vitest'
import { csvName, toCsv } from '../csv'

describe('CSV для Excel', () => {
  it('BOM, «;», кавычки и дробные с запятой', () => {
    const csv = toCsv(
      [
        { name: 'Болт М12; оцинк.', price: 14.9 },
        { name: 'Гайка "М12"', price: null },
      ],
      [
        { title: 'Наименование', value: (r) => r.name },
        { title: 'Цена', value: (r) => r.price },
      ],
    )
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split('\r\n')).toEqual(['Наименование;Цена', '"Болт М12; оцинк.";14,9', '"Гайка ""М12""";'])
  })

  it('имя файла без пробелов и спецсимволов', () => {
    expect(csvName('Счета-фактуры / входящие', new Date('2026-11-05T10:00:00Z'))).toBe('Счета-фактуры_входящие_2026-11-05.csv')
  })
})
