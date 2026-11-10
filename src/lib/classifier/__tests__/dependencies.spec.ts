import { describe, expect, it } from 'vitest'
import { toolClassifier } from '@/mocks/data/classifiers/tool'
import type { Classifier } from '@/types'
import { collectRules, resolveOverrides, ruleMatches, validateRules } from '../dependencies'
import { analyzeValues, buildCode, parseCode } from '../parser'
import { conflicting, DRILL_VALUES } from './fixtures'

const CUT = 'cat-cutting'
const facet = (r: ReturnType<typeof analyzeValues>, id: string) => r.facets.find((f) => f.facetId === id)

describe('зависимости фасетов', () => {
  it('мок сложного классификатора: ≥ 3 правил и конфиг без ошибок', () => {
    expect(collectRules(toolClassifier.facets).length).toBeGreaterThanOrEqual(3)
    expect(validateRules(toolClassifier)).toEqual([])
  })

  it('без совпавших правил переопределений нет', () => {
    const r = analyzeValues(toolClassifier, CUT, DRILL_VALUES)
    expect(r.overrides).toEqual({})
    expect(r.facets.every((f) => f.overriddenFields.length === 0)).toBe(true)
  })

  it('частичная зависимость: меняется только label, options остаются; у другого — только options', () => {
    const r = analyzeValues(toolClassifier, CUT, { ...DRILL_VALUES, 'f-drill-type': '2' })
    const len = facet(r, 'f-length')
    expect(len?.label).toBe('Длина центровочной части, мм')
    expect(len?.overriddenFields).toEqual(['label'])
    const prec = facet(r, 'f-precision')
    expect(prec?.label).toBe('Класс точности')
    expect(prec?.options?.map((o) => o.code)).toEqual(['H8'])
  })

  it('visible: true открывает скрытый фасет, и он участвует в шифре', () => {
    const values = { ...DRILL_VALUES, 'f-drill-type': '3', 'f-steps': '2' }
    const r = analyzeValues(toolClassifier, CUT, values)
    expect(facet(r, 'f-steps')?.visible).toBe(true)
    expect(parseCode(toolClassifier, CUT, r.code).values['f-steps']).toBe('2')
  })

  it('visible: false — фасет не занимает символов в шифре', () => {
    const mill = {
      'f-group': 'FR', 'f-mill-type': '2', 'f-material': 'H', 'f-coating': 'A', 'f-diameter': '80',
      'f-length': '40', 'f-teeth': '6', 'f-shank': 'C', 'f-precision': 'H8', 'f-coolant': '1',
    }
    const r = analyzeValues(toolClassifier, CUT, mill)
    expect(facet(r, 'f-shank')?.visible).toBe(false)
    expect(facet(r, 'f-shank')?.value).toBe('')
    expect(r.code).not.toContain('C')
    const back = parseCode(toolClassifier, CUT, r.code)
    expect(back.valid).toBe(true)
    expect(back.values['f-precision']).toBe('H8')
  })

  it('3+ правила одновременно (ступенчатое + керамика + конус Морзе + микродиаметр)', () => {
    const values = {
      ...DRILL_VALUES,
      'f-drill-type': '3', 'f-material': 'K', 'f-coating': '0', 'f-diameter': '2.5',
      'f-shank': 'K', 'f-precision': 'M2', 'f-steps': '2',
    }
    const r = analyzeValues(toolClassifier, CUT, values)
    expect(Object.keys(r.overrides).sort()).toEqual(['f-coating', 'f-coolant', 'f-diameter', 'f-precision', 'f-steps'])
    expect(facet(r, 'f-steps')?.visible).toBe(true)
    expect(facet(r, 'f-coating')?.options?.map((o) => o.code)).toEqual(['0'])
    // На СОЖ сработали два правила: options от керамики и visible от микродиаметра
    expect(r.overrides['f-coolant']?.ruleIds).toEqual(['r-material-ceramic', 'r-diameter-micro'])
    expect(facet(r, 'f-coolant')?.visible).toBe(false)
    expect(facet(r, 'f-precision')?.label).toBe('Номер конуса Морзе')
    expect(r.issues.filter((i) => i.facetId !== 'f-standard')).toEqual([])
    expect(parseCode(toolClassifier, CUT, buildCode(toolClassifier, CUT, values)).values).toMatchObject({ 'f-precision': 'M2' })
  })

  it('значение вне переопределённого списка → ошибка option', () => {
    const r = analyzeValues(toolClassifier, CUT, { ...DRILL_VALUES, 'f-material': 'K', 'f-coating': 'A' })
    expect(r.issues.find((i) => i.facetId === 'f-coating')?.code).toBe('option')
  })

  it('конфликт правил: по полю выигрывает более поздний триггер', () => {
    const r = analyzeValues(conflicting, 'cat', { a: '1', b: '1', c: '1' })
    expect(r.facets[2]?.label).toBe('from B')
    expect(r.overrides['c']?.ruleIds).toEqual(['ra', 'rb'])
    expect(r.overrides['c']?.visible).toBe(true)
  })

  it('правило не действует «назад» на предыдущие фасеты', () => {
    const r = analyzeValues(conflicting, 'cat', { a: '1', b: '1', c: '1' })
    expect(r.facets[0]?.label).toBe('A')
    expect(r.overrides['a']).toBeUndefined()
  })

  it('ruleMatches: triggerCondition приоритетнее triggerValue; числовой triggerValue', () => {
    const rules = collectRules(toolClassifier.facets)
    const micro = rules.find((x) => x.id === 'r-diameter-micro')
    if (!micro) throw new Error('нет правила')
    expect(ruleMatches(micro, '2,5')).toBe(true)
    expect(ruleMatches(micro, '3')).toBe(false)
    expect(ruleMatches({ id: 'n', triggerFacetId: 'x', triggerValue: 5, overrides: [] }, '05')).toBe(true)
    expect(ruleMatches(micro, '')).toBe(false)
  })

  it('resolveOverrides: триггер вне пути игнорируется', () => {
    const rules = collectRules(toolClassifier.facets)
    expect(resolveOverrides(rules, { 'f-mill-type': '2' }, ['f-group'])).toEqual({})
  })

  it('validateRules находит ошибки конфигурации', () => {
    const broken: Classifier = {
      ...conflicting,
      facets: conflicting.facets.map((f) =>
        f.id === 'a'
          ? { ...f, dependencies: [{ id: 'bad', triggerFacetId: 'b', triggerValue: '1', overrides: [{ facetId: 'zzz' }] }] }
          : f,
      ),
    }
    const msgs = validateRules(broken).map((i) => i.message)
    expect(msgs.some((m) => m.includes('не совпадает'))).toBe(true)
    expect(msgs.some((m) => m.includes('zzz'))).toBe(true)
  })
})
