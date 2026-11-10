import { describe, expect, it } from 'vitest'
import { toolClassifier } from '@/mocks/data/classifiers/tool'
import { materialClassifier } from '@/mocks/data/classifiers/material'
import { analyzeValues, buildCode, normalizeCode, parseCode } from '../parser'
import { branchDefault1, delimited, DRILL_CODE, DRILL_VALUES, fixedOnly } from './fixtures'

const CUT = 'cat-cutting'
const issueCodes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code)

describe('parseCode — общие случаи', () => {
  it('пустой шифр: issue «empty», значения пусты, путь по умолчанию', () => {
    const r = parseCode(toolClassifier, CUT, '   ')
    expect(r.valid).toBe(false)
    expect(issueCodes(r)[0]).toBe('empty')
    expect(r.facets.every((f) => f.value === '')).toBe(true)
    // Без значений путь идёт по первым дочерним нодам → ветка сверла
    expect(r.facets[1]?.facetId).toBe('f-drill-type')
    expect(r.rest).toBe('')
  })

  it('чтение справа налево: ручной шифр разбирается в ожидаемые значения', () => {
    const r = parseCode(toolClassifier, CUT, DRILL_CODE)
    expect(r.issues).toEqual([])
    for (const [id, v] of Object.entries(DRILL_VALUES)) expect(r.values[id]).toBe(v)
  })

  it('сборка: значения → тот же ручной шифр', () => {
    expect(buildCode(toolClassifier, CUT, DRILL_VALUES)).toBe(DRILL_CODE)
  })

  it('round-trip: parse(build(values)) = values', () => {
    const values = { ...DRILL_VALUES, 'f-diameter': '15', 'f-flutes': '3' }
    const code = buildCode(toolClassifier, CUT, values)
    const r = parseCode(toolClassifier, CUT, code)
    expect(r.valid).toBe(true)
    expect(r.values).toMatchObject(values)
  })

  it('spans указывают на позиции в строке (rtl: группа — 2 правых символа)', () => {
    const r = parseCode(toolClassifier, CUT, DRILL_CODE)
    const len = Array.from(DRILL_CODE).length
    expect(r.facets[0]?.span).toEqual({ start: len - 2, end: len })
    const std = r.facets.find((f) => f.facetId === 'f-standard')
    expect(std?.span).toEqual({ start: 0, end: 9 })
  })

  it('analyzeValues даёт те же spans, что и parseCode', () => {
    const a = analyzeValues(toolClassifier, CUT, DRILL_VALUES)
    const p = parseCode(toolClassifier, CUT, a.code)
    expect(a.facets.map((f) => f.span)).toEqual(p.facets.map((f) => f.span))
  })

  it('неизвестный каталог', () => {
    expect(issueCodes(parseCode(toolClassifier, 'nope', 'X'))).toContain('catalog-not-found')
  })

  it('normalizeCode: пробелы и регистр', () => {
    expect(normalizeCode(' ab 12 ')).toBe('AB12')
  })
})

describe('parseCode — длины фасетов', () => {
  it('ltr + fixed + remainder в конце забирает весь остаток', () => {
    const r = parseCode(materialClassifier, 'cat-materials', '0112Сталь45X')
    expect(r.values).toEqual({ 'm-class': '01', 'm-group': '12', 'm-kind': 'Сталь45X' })
    expect(r.valid).toBe(true)
  })

  it('короткий шифр: недостающие фасеты пусты и обязательны', () => {
    const r = parseCode(materialClassifier, 'cat-materials', '01')
    expect(r.values['m-group']).toBe('')
    expect(r.issues.filter((i) => i.code === 'required').map((i) => i.facetId)).toEqual(['m-group', 'm-kind'])
  })

  it('обрезанный fixed-фасет даёт ошибку длины', () => {
    const r = parseCode(materialClassifier, 'cat-materials', '0')
    expect(r.issues.find((i) => i.facetId === 'm-class')?.code).toBe('length')
  })

  it('длина по умолчанию = 1, если fixedLength не задан', () => {
    const r = parseCode(fixedOnly, 'cat', 'QWE')
    expect(r.values).toEqual({ a: 'Q', b: 'WE' })
  })

  it('лишние символы после последнего фасета → issue «rest»', () => {
    const r = parseCode(fixedOnly, 'cat', 'QWERTY')
    expect(r.rest).toBe('RTY')
    expect(issueCodes(r)).toContain('rest')
  })

  it('delimiter: фасет до разделителя, remainder после', () => {
    expect(parseCode(delimited, 'cat', 'ABC/DE').values).toEqual({ a: 'ABC', b: 'DE' })
  })

  it('delimiter не найден — фасет до конца шифра', () => {
    const r = parseCode(delimited, 'cat', 'ABC')
    expect(r.values).toEqual({ a: 'ABC', b: '' })
  })

  it('недопустимые символы', () => {
    expect(issueCodes(parseCode(materialClassifier, 'cat-materials', '0112Ст!'))).toContain('chars')
  })

  it('неверный тип данных фасета', () => {
    const r = analyzeValues(toolClassifier, CUT, { ...DRILL_VALUES, 'f-length': 'AB' })
    expect(r.issues.find((i) => i.facetId === 'f-length')?.code).toBe('data-type')
  })
})

describe('выбор ветки структуры', () => {
  it('fallback на первую дочернюю ноду, если ни одно условие не выполнено', () => {
    const r = parseCode(toolClassifier, CUT, '1XX')
    expect(r.facets[0]?.issues[0]?.code).toBe('option')
    expect(r.facets[1]?.facetId).toBe('f-drill-type')
    expect(r.facets[1]?.branch).toBe('default')
  })

  it('учитывается defaultChildIndex', () => {
    const r = parseCode(branchDefault1, 'cat', 'QZ')
    expect(r.facets[1]?.facetId).toBe('y')
    expect(r.facets[1]?.branch).toBe('default')
  })

  it('переход по условию: строка', () => {
    const r = analyzeValues(toolClassifier, CUT, { 'f-group': 'FR' })
    expect(r.facets[1]?.facetId).toBe('f-mill-type')
    expect(r.facets[1]?.branch).toBe('condition')
  })

  it('переход по условию: диапазон (крупное сверло получает число канавок)', () => {
    const small = analyzeValues(toolClassifier, CUT, DRILL_VALUES)
    const big = analyzeValues(toolClassifier, CUT, { ...DRILL_VALUES, 'f-diameter': '15' })
    expect(small.facets.some((f) => f.facetId === 'f-flutes')).toBe(false)
    expect(big.facets.some((f) => f.facetId === 'f-flutes')).toBe(true)
  })
})
