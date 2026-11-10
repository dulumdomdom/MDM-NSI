// Условия перехода (12 типов по ТЗ): вычисление, разбор пользовательского ввода, форматирование.
// Чистые функции, без Vue. Используется парсером, декодером, зависимостями и ConditionEditor.

import type { ConditionType, NumRange, TransitionCondition } from '@/types'

const EPS = 1e-9

const TRUE_SET = new Set(['1', 'true', 't', 'y', 'yes', 'д', 'да', '+'])
const FALSE_SET = new Set(['0', 'false', 'f', 'n', 'no', 'н', 'нет', '-'])

/** Справочник типов условий для UI (порядок = порядок ТЗ) */
export const CONDITION_TYPES: { type: ConditionType; label: string; hint: string }[] = [
  { type: 'string', label: 'Строка', hint: 'ABC' },
  { type: 'int', label: 'Целое число', hint: '42' },
  { type: 'float', label: 'Дробное число', hint: '3.14' },
  { type: 'bool', label: 'Boolean', hint: 'да / нет' },
  { type: 'intRange', label: 'Диапазон целых', hint: '1..10' },
  { type: 'floatRange', label: 'Диапазон дробных', hint: '0.5..12.99' },
  { type: 'stringArray', label: 'Массив строк', hint: 'A; B; C' },
  { type: 'intArray', label: 'Массив целых', hint: '1; 2; 5' },
  { type: 'floatArray', label: 'Массив дробных', hint: '1.5; 2.5' },
  { type: 'boolArray', label: 'Массив Boolean', hint: 'да; нет' },
  { type: 'intRangeArray', label: 'Массив диапазонов целых', hint: '1..5; 10..20' },
  { type: 'floatRangeArray', label: 'Массив диапазонов дробных', hint: '0..1.5; 3..4.5' },
]

/* ----------------------------- примитивы ----------------------------- */

export function parseBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase()
  if (TRUE_SET.has(v)) return true
  if (FALSE_SET.has(v)) return false
  return null
}

export function parseIntStrict(raw: string): number | null {
  const v = raw.trim()
  if (!/^[+-]?\d+$/.test(v)) return null
  const n = Number.parseInt(v, 10)
  return Number.isSafeInteger(n) ? n : null
}

/** Дробное число; допускается запятая как десятичный разделитель */
export function parseFloatStrict(raw: string): number | null {
  const v = raw.trim().replace(',', '.')
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(v)) return null
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export function inRange(n: number, r: NumRange): boolean {
  return n >= r.min - EPS && n <= r.max + EPS
}

const approxEq = (a: number, b: number): boolean => Math.abs(a - b) < EPS

/* ----------------------------- вычисление ---------------------------- */

/** Удовлетворяет ли сырое значение фасета условию */
export function evaluateCondition(c: TransitionCondition, raw: string): boolean {
  const v = raw.trim()
  switch (c.type) {
    case 'string':
      return v === c.value
    case 'int': {
      const n = parseIntStrict(v)
      return n !== null && n === c.value
    }
    case 'float': {
      const n = parseFloatStrict(v)
      return n !== null && approxEq(n, c.value)
    }
    case 'bool': {
      const b = parseBool(v)
      return b !== null && b === c.value
    }
    case 'intRange': {
      const n = parseIntStrict(v)
      return n !== null && inRange(n, c.value)
    }
    case 'floatRange': {
      const n = parseFloatStrict(v)
      return n !== null && inRange(n, c.value)
    }
    case 'stringArray':
      return c.value.includes(v)
    case 'intArray': {
      const n = parseIntStrict(v)
      return n !== null && c.value.includes(n)
    }
    case 'floatArray': {
      const n = parseFloatStrict(v)
      return n !== null && c.value.some((x) => approxEq(x, n))
    }
    case 'boolArray': {
      const b = parseBool(v)
      return b !== null && c.value.includes(b)
    }
    case 'intRangeArray': {
      const n = parseIntStrict(v)
      return n !== null && c.value.some((r) => inRange(n, r))
    }
    case 'floatRangeArray': {
      const n = parseFloatStrict(v)
      return n !== null && c.value.some((r) => inRange(n, r))
    }
    default: {
      const exhaustive: never = c
      return exhaustive
    }
  }
}

/* --------------------- ввод условия в редакторе --------------------- */

export type ConditionParseResult = { ok: true; condition: TransitionCondition } | { ok: false; error: string }

const splitList = (text: string): string[] =>
  text
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

function parseRange(text: string, num: (s: string) => number | null): NumRange | null {
  const [a, b, ...extra] = text.split('..')
  if (a === undefined || b === undefined || extra.length > 0) return null
  const min = num(a)
  const max = num(b)
  if (min === null || max === null || min > max) return null
  return { min, max }
}

function parseAll<T>(items: string[], fn: (s: string) => T | null): T[] | null {
  const out: T[] = []
  for (const it of items) {
    const v = fn(it)
    if (v === null) return null
    out.push(v)
  }
  return out
}

const fail = (error: string): ConditionParseResult => ({ ok: false, error })

/**
 * Разбор текстового ввода в типизированное условие.
 * Формат: диапазон «min..max», элементы массива через «;».
 */
export function parseConditionInput(type: ConditionType, text: string): ConditionParseResult {
  const t = text.trim()
  if (t === '' && type !== 'string') return fail('Значение не задано')
  const intR = (s: string) => parseRange(s, parseIntStrict)
  const floatR = (s: string) => parseRange(s, parseFloatStrict)
  switch (type) {
    case 'string':
      return { ok: true, condition: { type, value: t } }
    case 'int': {
      const n = parseIntStrict(t)
      return n === null ? fail('Ожидается целое число') : { ok: true, condition: { type, value: n } }
    }
    case 'float': {
      const n = parseFloatStrict(t)
      return n === null ? fail('Ожидается число') : { ok: true, condition: { type, value: n } }
    }
    case 'bool': {
      const b = parseBool(t)
      return b === null ? fail('Ожидается да/нет') : { ok: true, condition: { type, value: b } }
    }
    case 'intRange': {
      const r = intR(t)
      return r === null ? fail('Ожидается диапазон целых «min..max»') : { ok: true, condition: { type, value: r } }
    }
    case 'floatRange': {
      const r = floatR(t)
      return r === null ? fail('Ожидается диапазон «min..max»') : { ok: true, condition: { type, value: r } }
    }
    case 'stringArray': {
      const items = splitList(t)
      return items.length === 0 ? fail('Пустой массив') : { ok: true, condition: { type, value: items } }
    }
    case 'intArray': {
      const items = parseAll(splitList(t), parseIntStrict)
      return items === null ? fail('Элементы — целые числа через «;»') : { ok: true, condition: { type, value: items } }
    }
    case 'floatArray': {
      const items = parseAll(splitList(t), parseFloatStrict)
      return items === null ? fail('Элементы — числа через «;»') : { ok: true, condition: { type, value: items } }
    }
    case 'boolArray': {
      const items = parseAll(splitList(t), parseBool)
      return items === null ? fail('Элементы — да/нет через «;»') : { ok: true, condition: { type, value: items } }
    }
    case 'intRangeArray': {
      const items = parseAll(splitList(t), intR)
      return items === null ? fail('Диапазоны «min..max» через «;»') : { ok: true, condition: { type, value: items } }
    }
    case 'floatRangeArray': {
      const items = parseAll(splitList(t), floatR)
      return items === null ? fail('Диапазоны «min..max» через «;»') : { ok: true, condition: { type, value: items } }
    }
    default: {
      const exhaustive: never = type
      return fail(`Неизвестный тип ${String(exhaustive)}`)
    }
  }
}

/* ---------------------------- отображение ---------------------------- */

const fmtRange = (r: NumRange): string => `${r.min}..${r.max}`
const fmtBool = (b: boolean): string => (b ? 'да' : 'нет')

/** Значение условия в формате ввода (обратное к parseConditionInput) */
export function conditionToInput(c: TransitionCondition): string {
  switch (c.type) {
    case 'string':
      return c.value
    case 'int':
    case 'float':
      return String(c.value)
    case 'bool':
      return fmtBool(c.value)
    case 'intRange':
    case 'floatRange':
      return fmtRange(c.value)
    case 'stringArray':
      return c.value.join('; ')
    case 'intArray':
    case 'floatArray':
      return c.value.map(String).join('; ')
    case 'boolArray':
      return c.value.map(fmtBool).join('; ')
    case 'intRangeArray':
    case 'floatRangeArray':
      return c.value.map(fmtRange).join('; ')
    default: {
      const exhaustive: never = c
      return exhaustive
    }
  }
}

/** Человекочитаемое описание: «∈ [1..5]», «= SV» */
export function formatCondition(c: TransitionCondition): string {
  const input = conditionToInput(c)
  switch (c.type) {
    case 'string':
    case 'int':
    case 'float':
    case 'bool':
      return `= ${input}`
    case 'intRange':
    case 'floatRange':
      return `∈ [${input}]`
    default:
      return `∈ {${input}}`
  }
}

/**
 * Пример значения, удовлетворяющего условию. Нужен, чтобы «перейти» в ветку дерева:
 * подставить родительскому фасету значение, ведущее в выбранную ноду.
 */
export function sampleValue(c: TransitionCondition): string {
  switch (c.type) {
    case 'string':
      return c.value
    case 'int':
    case 'float':
      return String(c.value)
    case 'bool':
      return c.value ? '1' : '0'
    case 'intRange':
    case 'floatRange':
      return String(c.value.min)
    case 'stringArray':
      return c.value[0] ?? ''
    case 'intArray':
    case 'floatArray':
      return c.value[0] === undefined ? '' : String(c.value[0])
    case 'boolArray':
      return c.value[0] === undefined ? '' : c.value[0] ? '1' : '0'
    case 'intRangeArray':
    case 'floatRangeArray':
      return c.value[0] === undefined ? '' : String(c.value[0].min)
    default: {
      const exhaustive: never = c
      return exhaustive
    }
  }
}
