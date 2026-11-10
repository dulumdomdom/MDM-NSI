// Разбор и сборка шифра. ОДНА реализация для обоих режимов ввода:
//  - parseCode     — direct: строка шифра → значения фасетов;
//  - analyzeValues — wizard: значения фасетов → шифр.
// Оба используют общий обход дерева walkStructure, отличаются только источником значений.
//
// Направление чтения (ТЗ: справа налево). Для 'rtl' строка переворачивается в «поток чтения»:
// первый фасет — крайние правые символы. Значение фасета при этом пишется обычным образом.

import type { Classifier, FacetConfig, ReadDirection } from '@/types'
import { parseBool, parseFloatStrict, parseIntStrict } from './conditions'
import {
  collectRules,
  effectiveFacet,
  resolveOverrides,
  type EffectiveFacet,
  type OverrideMap,
} from './dependencies'
import { facetMap, getCatalog, selectChild, type BranchReason } from './structure'

export type IssueCode =
  | 'catalog-not-found'
  | 'facet-not-found'
  | 'empty'
  | 'required'
  | 'length'
  | 'data-type'
  | 'option'
  | 'chars'
  | 'rest'
  | 'depth'

export interface ParseIssue {
  code: IssueCode
  message: string
  facetId?: string
}

/** Позиция значения фасета в строке шифра: [start, end) по символам (code points) */
export interface Span {
  start: number
  end: number
}

export interface ParsedFacet extends EffectiveFacet {
  facetId: string
  nodeId: string
  /** Порядковый номер в пути (порядок чтения), с 0 */
  index: number
  value: string
  config: FacetConfig
  section: string
  required: boolean
  /** Как была выбрана нода этого фасета */
  branch: BranchReason
  span: Span | null
  issues: ParseIssue[]
}

export interface ParseResult {
  classifierId: string
  catalogId: string
  /** Шифр: для parseCode — введённая строка, для analyzeValues — собранная */
  code: string
  /** id нод от каталога до последней facet-ноды */
  path: string[]
  facets: ParsedFacet[]
  values: Record<string, string>
  /** Неразобранный хвост шифра */
  rest: string
  issues: ParseIssue[]
  valid: boolean
  overrides: OverrideMap
}

const MAX_DEPTH = 256
const DEFAULT_ALLOWED = '[\\p{L}\\p{N}]'

/* ------------------------------------------------------------------ */
/* Общий обход дерева                                                 */
/* ------------------------------------------------------------------ */

/** Источник значения фасета: из потока символов или из словаря значений */
type ValueSource = (facet: FacetConfig, isLast: boolean) => { value: string; streamSpan: Span | null }

interface WalkResult {
  path: string[]
  facets: ParsedFacet[]
  values: Record<string, string>
  issues: ParseIssue[]
  overrides: OverrideMap
}

function walkStructure(classifier: Classifier, catalogId: string, source: ValueSource): WalkResult {
  const res: WalkResult = { path: [], facets: [], values: {}, issues: [], overrides: {} }
  const catalog = getCatalog(classifier, catalogId)
  if (!catalog) {
    res.issues.push({ code: 'catalog-not-found', message: `Каталог «${catalogId}» не найден` })
    return res
  }
  const byId = facetMap(classifier)
  const rules = collectRules(classifier.facets)
  const order: string[] = []
  const allowed = new RegExp(`^${classifier.allowedCharsPattern ?? DEFAULT_ALLOWED}$`, 'u')

  res.path.push(catalog.id)
  let sel = selectChild(catalog, '')
  let depth = 0
  while (sel) {
    if (++depth > MAX_DEPTH) {
      res.issues.push({ code: 'depth', message: 'Превышена глубина структуры' })
      break
    }
    const node = sel.node
    res.path.push(node.id)
    if (node.kind !== 'facet' || !node.facetId) {
      sel = selectChild(node, '')
      continue
    }
    const facet = byId.get(node.facetId)
    if (!facet) {
      res.issues.push({ code: 'facet-not-found', message: `Фасет «${node.facetId}» не описан`, facetId: node.facetId })
      break
    }
    // Инкрементально: на фасет действуют только правила уже прочитанных фасетов
    const eff = effectiveFacet(facet, resolveOverrides(rules, res.values, order)[facet.id])
    const isLast = node.children.length === 0
    const { value, streamSpan } = eff.visible ? source(facet, isLast) : { value: '', streamSpan: null }
    const issues = validateValue(facet, eff, value, allowed)

    order.push(facet.id)
    res.values[facet.id] = value
    res.facets.push({
      ...eff,
      facetId: facet.id,
      nodeId: node.id,
      index: res.facets.length,
      value,
      config: facet,
      section: facet.section,
      required: facet.required && eff.visible,
      branch: sel.reason,
      span: streamSpan,
      issues,
    })
    res.issues.push(...issues)
    sel = selectChild(node, value)
  }
  res.overrides = resolveOverrides(rules, res.values, order)
  return res
}

/* ------------------------------------------------------------------ */
/* Валидация значения фасета                                           */
/* ------------------------------------------------------------------ */

export function validateValue(facet: FacetConfig, eff: EffectiveFacet, value: string, allowed: RegExp): ParseIssue[] {
  const issues: ParseIssue[] = []
  const add = (code: IssueCode, message: string) => issues.push({ code, message, facetId: facet.id })
  if (value === '') {
    if (facet.required && eff.visible) add('required', `«${eff.label}»: обязательный фасет не заполнен`)
    return issues
  }
  const chars = Array.from(value)
  if (facet.lengthMode === 'fixed') {
    const len = facet.fixedLength ?? facet.defaultLength
    if (chars.length !== len) add('length', `«${eff.label}»: длина ${chars.length}, ожидается ${len}`)
  }
  if (chars.some((ch) => !allowed.test(ch)) && !(facet.dataType === 'float' && /^[+-]?[\d.,]+$/.test(value))) {
    add('chars', `«${eff.label}»: недопустимые символы`)
  }
  if (facet.lengthMode === 'delimiter' && facet.delimiter && value.includes(facet.delimiter)) {
    add('chars', `«${eff.label}»: значение содержит разделитель «${facet.delimiter}»`)
  }
  const typeOk =
    facet.dataType === 'int'
      ? parseIntStrict(value) !== null
      : facet.dataType === 'float'
        ? parseFloatStrict(value) !== null
        : facet.dataType === 'bool'
          ? parseBool(value) !== null
          : true
  if (!typeOk) add('data-type', `«${eff.label}»: ожидается тип ${facet.dataType}`)
  if (eff.options && eff.options.length > 0 && !eff.options.some((o) => o.code === value)) {
    add('option', `«${eff.label}»: значение «${value}» не из списка`)
  }
  return issues
}

/* ------------------------------------------------------------------ */
/* Ориентация: строка ↔ поток чтения                                   */
/* ------------------------------------------------------------------ */

const toStream = (s: string, dir: ReadDirection): string[] => {
  const chars = Array.from(s)
  return dir === 'rtl' ? chars.reverse() : chars
}

const fromStream = (chars: string[], dir: ReadDirection): string =>
  (dir === 'rtl' ? [...chars].reverse() : chars).join('')

/** Позиция в потоке → позиция в строке */
const toStringSpan = (s: Span, total: number, dir: ReadDirection): Span =>
  dir === 'rtl' ? { start: total - s.end, end: total - s.start } : s

function indexOfSeq(hay: string[], needle: string[], from: number): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}

/* ------------------------------------------------------------------ */
/* Публичное API                                                      */
/* ------------------------------------------------------------------ */

/** Разбор строки шифра (режим direct). Длины фасетов: fixed / delimiter / remainder / по умолчанию */
export function parseCode(classifier: Classifier, catalogId: string, rawCode: string): ParseResult {
  const code = rawCode.trim()
  const dir = classifier.readDirection
  const stream = toStream(code, dir)
  let pos = 0

  const source: ValueSource = (facet) => {
    if (pos >= stream.length) return { value: '', streamSpan: null }
    const start = pos
    let end: number
    if (facet.lengthMode === 'remainder') {
      end = stream.length
      pos = end
    } else if (facet.lengthMode === 'delimiter' && facet.delimiter) {
      const delim = toStream(facet.delimiter, dir)
      const at = indexOfSeq(stream, delim, pos)
      // Разделитель не найден — фасет заканчивается вместе с шифром
      end = at === -1 ? stream.length : at
      pos = at === -1 ? stream.length : at + delim.length
    } else {
      const len = facet.lengthMode === 'fixed' ? (facet.fixedLength ?? facet.defaultLength) : facet.defaultLength
      end = Math.min(start + len, stream.length)
      pos = end
    }
    return { value: fromStream(stream.slice(start, end), dir), streamSpan: { start, end } }
  }

  const walk = walkStructure(classifier, catalogId, source)
  const total = stream.length
  for (const f of walk.facets) if (f.span) f.span = toStringSpan(f.span, total, dir)

  const rest = fromStream(stream.slice(pos), dir)
  const issues = [...walk.issues]
  if (code === '') issues.unshift({ code: 'empty', message: 'Шифр пуст' })
  if (rest !== '') issues.push({ code: 'rest', message: `Лишние символы в шифре: «${rest}»` })
  return { classifierId: classifier.id, catalogId, code, ...walk, rest, issues, valid: issues.length === 0 }
}

/**
 * Анализ значений фасетов (режим wizard): путь, переопределения, валидация и СБОРКА шифра.
 * Сборка = конкатенация значений по порядку чтения; у delimiter-фасетов добавляется разделитель
 * (кроме последнего непустого — чтобы не плодить хвостовые разделители).
 */
export function analyzeValues(
  classifier: Classifier,
  catalogId: string,
  values: Readonly<Record<string, string>>,
): ParseResult {
  const walk = walkStructure(classifier, catalogId, (facet) => ({ value: (values[facet.id] ?? '').trim(), streamSpan: null }))
  const dir = classifier.readDirection

  let lastFilled = -1
  walk.facets.forEach((f, i) => {
    if (f.value !== '') lastFilled = i
  })
  const stream: string[] = []
  walk.facets.forEach((f, i) => {
    if (i > lastFilled) return
    const start = stream.length
    stream.push(...toStream(f.value, dir))
    f.span = f.value === '' ? null : { start, end: stream.length }
    if (f.config.lengthMode === 'delimiter' && f.config.delimiter && i < lastFilled) {
      stream.push(...toStream(f.config.delimiter, dir))
    }
  })
  for (const f of walk.facets) if (f.span) f.span = toStringSpan(f.span, stream.length, dir)

  const code = fromStream(stream, dir)
  return { classifierId: classifier.id, catalogId, code, ...walk, rest: '', issues: walk.issues, valid: walk.issues.length === 0 }
}

/** Только собрать шифр по значениям */
export function buildCode(classifier: Classifier, catalogId: string, values: Readonly<Record<string, string>>): string {
  return analyzeValues(classifier, catalogId, values).code
}

/** Нормализация шифра для сравнения (дубликат-чек): без пробелов, верхний регистр */
export function normalizeCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase()
}
