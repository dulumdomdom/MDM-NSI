import { describe, expect, it } from 'vitest'
import { toolClassifier } from '@/mocks/data/classifiers/tool'
import { materialClassifier } from '@/mocks/data/classifiers/material'
import { decode, decodeCode } from '../decoder'
import { analyzeValues, parseCode } from '../parser'
import { buildShortName } from '../shortName'
import { valuesForNode } from '../navigation'
import { DRILL_CODE, DRILL_VALUES } from './fixtures'

const CUT = 'cat-cutting'

describe('decoder', () => {
  it('расшифровка по структуре (первая подходящая)', () => {
    const d = decodeCode(toolClassifier, CUT, DRILL_CODE)
    expect(d.structureId).toBe('ds-drill')
    expect(d.text).toBe('Сверло спиральное Ø 6.5 мм, L 57 мм, твёрдый сплав TiAlN Хвостовик цилиндрический ГОСТ10902')
  })

  it('расшифровка по умолчанию — все фасеты через пробел', () => {
    const r = analyzeValues(toolClassifier, CUT, {
      'f-group': 'RZ', 'f-cutter-type': '1', 'f-material': 'P', 'f-coating': '0', 'f-holder': '20x20', 'f-hand': 'R',
    })
    const d = decode(toolClassifier, r)
    expect(d.structureId).toBeNull()
    expect(d.text).toBe('Резец проходной быстрорежущая сталь без покрытия 20x20 правое')
  })

  it('расшифровка зависит от шифра: имена берутся из переопределённых options', () => {
    const r = analyzeValues(toolClassifier, CUT, { ...DRILL_VALUES, 'f-shank': 'K', 'f-precision': 'M3' })
    const part = decode(toolClassifier, r).parts.find((p) => p.facetId === 'f-precision')
    expect(part).toEqual({ facetId: 'f-precision', label: 'Номер конуса Морзе', code: 'M3', name: 'КМ3' })
  })

  it('пустой шифр — пустая расшифровка по умолчанию', () => {
    const d = decodeCode(materialClassifier, 'cat-materials', '')
    expect(d.text).toBe('')
    expect(d.structureId).toBeNull()
  })

  it('значение без options расшифровывается самим значением', () => {
    expect(decodeCode(materialClassifier, 'cat-materials', '0712ПЭНД').text).toBe('Полимеры 12 ПЭНД')
  })

  it('скрытые фасеты не попадают в расшифровку', () => {
    const r = parseCode(toolClassifier, CUT, DRILL_CODE)
    expect(decode(toolClassifier, r).parts.some((p) => p.facetId === 'f-steps')).toBe(false)
  })
})

describe('краткое наименование', () => {
  it('по правилу из конфига', () => {
    const rule = toolClassifier.shortNameRule
    if (!rule) throw new Error('нет правила')
    const parts = decode(toolClassifier, analyzeValues(toolClassifier, CUT, DRILL_VALUES)).parts
    expect(buildShortName(rule, parts)).toBe('Сверло спиральное Ø6.5×57 H')
  })

  it('необязательный блок выпадает целиком, нормализация регистра и длины', () => {
    const parts = [
      { facetId: 'a', label: 'A', code: 'x', name: 'болт' },
      { facetId: 'b', label: 'B', code: '', name: '' },
    ]
    expect(buildShortName({ facetIds: ['a', 'b'], template: '{a}[ М{b:code}] ', normalize: { case: 'upper' } }, parts)).toBe('БОЛТ')
    expect(buildShortName({ facetIds: ['a'], template: '{a} {a} {a}', normalize: { maxLength: 9 } }, parts)).toBe('болт болт')
  })

  it('фасеты вне rule.facetIds не подставляются', () => {
    const parts = [{ facetId: 'a', label: 'A', code: 'x', name: 'болт' }]
    expect(buildShortName({ facetIds: [], template: '{a}, ok' }, parts)).toBe('ok')
  })
})

describe('навигация по дереву', () => {
  it('переход в ветку фрезы подставляет значение родителя', () => {
    const nav = valuesForNode(toolClassifier, 'm-f-mill-type', DRILL_VALUES)
    expect(nav?.catalogId).toBe(CUT)
    expect(nav?.values['f-group']).toBe('FR')
    expect(nav?.focusFacetId).toBe('f-mill-type')
  })

  it('переход в ветку по диапазону и сохранение подходящих значений', () => {
    const nav = valuesForNode(toolClassifier, 'db-f-flutes', DRILL_VALUES)
    expect(nav?.values['f-diameter']).toBe('13')
    expect(nav?.values['f-group']).toBe('SV')
    expect(valuesForNode(toolClassifier, 'missing', {})).toBeNull()
  })
})

describe('decoder — prefix/suffix', () => {
  it('единицы измерения не выводятся без значения фасета', () => {
    const d = decode(toolClassifier, analyzeValues(toolClassifier, CUT, { 'f-group': 'SV', 'f-drill-type': '3' }))
    expect(d.text).toBe('Сверло ступенчатое')
  })
})
