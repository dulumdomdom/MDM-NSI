import { describe, expect, it } from 'vitest'
import type { ConditionType, TransitionCondition } from '@/types'
import {
  CONDITION_TYPES,
  conditionToInput,
  evaluateCondition,
  formatCondition,
  parseConditionInput,
  sampleValue,
} from '../conditions'

describe('evaluateCondition — 12 типов', () => {
  it('string: точное совпадение, с обрезкой пробелов', () => {
    expect(evaluateCondition({ type: 'string', value: 'SV' }, 'SV')).toBe(true)
    expect(evaluateCondition({ type: 'string', value: 'SV' }, ' SV ')).toBe(true)
    expect(evaluateCondition({ type: 'string', value: 'SV' }, 'sv')).toBe(false)
  })

  it('int: числовое сравнение («05» = 5), дробь не подходит', () => {
    const c: TransitionCondition = { type: 'int', value: 5 }
    expect(evaluateCondition(c, '05')).toBe(true)
    expect(evaluateCondition(c, '+5')).toBe(true)
    expect(evaluateCondition(c, '5.0')).toBe(false)
  })

  it('float: запятая как десятичный разделитель', () => {
    expect(evaluateCondition({ type: 'float', value: 6.5 }, '6,5')).toBe(true)
    expect(evaluateCondition({ type: 'float', value: 6.5 }, '6.50')).toBe(true)
    expect(evaluateCondition({ type: 'float', value: 6.5 }, '6.51')).toBe(false)
  })

  it('bool: синонимы да/нет/1/0', () => {
    expect(evaluateCondition({ type: 'bool', value: true }, 'да')).toBe(true)
    expect(evaluateCondition({ type: 'bool', value: true }, '1')).toBe(true)
    expect(evaluateCondition({ type: 'bool', value: false }, 'Нет')).toBe(true)
    expect(evaluateCondition({ type: 'bool', value: true }, 'maybe')).toBe(false)
  })

  it('intRange: границы включительно', () => {
    const c: TransitionCondition = { type: 'intRange', value: { min: 1, max: 10 } }
    expect(evaluateCondition(c, '1')).toBe(true)
    expect(evaluateCondition(c, '10')).toBe(true)
    expect(evaluateCondition(c, '11')).toBe(false)
    expect(evaluateCondition(c, '5.5')).toBe(false)
  })

  it('floatRange', () => {
    const c: TransitionCondition = { type: 'floatRange', value: { min: 0.1, max: 12.99 } }
    expect(evaluateCondition(c, '12.99')).toBe(true)
    expect(evaluateCondition(c, '13')).toBe(false)
  })

  it('stringArray', () => {
    expect(evaluateCondition({ type: 'stringArray', value: ['FR', 'RZ'] }, 'RZ')).toBe(true)
    expect(evaluateCondition({ type: 'stringArray', value: ['FR', 'RZ'] }, 'SV')).toBe(false)
  })

  it('intArray', () => {
    expect(evaluateCondition({ type: 'intArray', value: [1, 2, 5] }, '5')).toBe(true)
    expect(evaluateCondition({ type: 'intArray', value: [1, 2, 5] }, '3')).toBe(false)
  })

  it('floatArray', () => {
    expect(evaluateCondition({ type: 'floatArray', value: [1.5, 2.5] }, '2,5')).toBe(true)
    expect(evaluateCondition({ type: 'floatArray', value: [1.5, 2.5] }, '2')).toBe(false)
  })

  it('boolArray', () => {
    expect(evaluateCondition({ type: 'boolArray', value: [true] }, 'y')).toBe(true)
    expect(evaluateCondition({ type: 'boolArray', value: [true] }, '0')).toBe(false)
  })

  it('intRangeArray: попадание в любой из диапазонов', () => {
    const c: TransitionCondition = { type: 'intRangeArray', value: [{ min: 1, max: 5 }, { min: 10, max: 20 }] }
    expect(evaluateCondition(c, '15')).toBe(true)
    expect(evaluateCondition(c, '7')).toBe(false)
  })

  it('floatRangeArray', () => {
    const c: TransitionCondition = { type: 'floatRangeArray', value: [{ min: 0, max: 1.5 }, { min: 3, max: 4.5 }] }
    expect(evaluateCondition(c, '4.5')).toBe(true)
    expect(evaluateCondition(c, '2')).toBe(false)
  })

  it('мусор вместо числа — условие не выполнено (без исключений)', () => {
    expect(evaluateCondition({ type: 'int', value: 1 }, 'abc')).toBe(false)
    expect(evaluateCondition({ type: 'floatRange', value: { min: 0, max: 1 } }, '')).toBe(false)
  })
})

describe('parseConditionInput / conditionToInput', () => {
  const samples: Record<ConditionType, string> = {
    string: 'SV',
    int: '42',
    float: '3.14',
    bool: 'да',
    intRange: '1..10',
    floatRange: '0.5..12.99',
    stringArray: 'A; B; C',
    intArray: '1; 2; 5',
    floatArray: '1.5; 2.5',
    boolArray: 'да; нет',
    intRangeArray: '1..5; 10..20',
    floatRangeArray: '0..1.5; 3..4.5',
  }

  it.each(CONDITION_TYPES.map((t) => t.type))('%s: разбор и обратное форматирование', (type) => {
    const parsed = parseConditionInput(type, samples[type])
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.condition.type).toBe(type)
    expect(conditionToInput(parsed.condition)).toBe(samples[type])
  })

  it('ошибки ввода', () => {
    expect(parseConditionInput('int', '1.5').ok).toBe(false)
    expect(parseConditionInput('intRange', '10..1').ok).toBe(false)
    expect(parseConditionInput('intArray', '1; x').ok).toBe(false)
    expect(parseConditionInput('float', '').ok).toBe(false)
  })

  it('formatCondition', () => {
    expect(formatCondition({ type: 'string', value: 'SV' })).toBe('= SV')
    expect(formatCondition({ type: 'intRange', value: { min: 1, max: 3 } })).toBe('∈ [1..3]')
    expect(formatCondition({ type: 'intArray', value: [1, 2] })).toBe('∈ {1; 2}')
  })

  it.each(CONDITION_TYPES.map((t) => t.type))('sampleValue(%s) удовлетворяет условию', (type) => {
    const parsed = parseConditionInput(type, samples[type])
    if (!parsed.ok) throw new Error(parsed.error)
    expect(evaluateCondition(parsed.condition, sampleValue(parsed.condition))).toBe(true)
  })
})
