// Умный поиск наименований: пользователь вводит спецификацию как пишет («Болт М12х50 оцинк., шт» или
// «Сверло 6,5 Р6М5; Артикул: SV-6.5»), система находит элементы и объясняет, по чему совпало.
//  - нормализация: регистр, ё/е, кириллица/латиница одинакового вида (М12 = M12), «х/×/*» в размерах,
//    запятая в дробях, сокращения (префиксы: «оцинк» → «оцинкованный»), опечатки (Левенштейн);
//  - свойства: «Свойство: значение» ищется только в этом атрибуте;
//  - шифры элементов участвуют в поиске наравне с атрибутами.
// Чистые функции, без Vue.

import type { AttributeValue, CatalogAttribute, ReferenceValue } from '@/types'
import { similarity } from './search'

/* ---------------------------- нормализация ---------------------------- */

/** Кириллические буквы, неотличимые от латинских, — к латинице (сравнение «как видит человек») */
const HOMOGLYPHS: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x',
}

export function normalizeForSearch(text: string): string {
  return Array.from(
    text
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[ø⌀]/g, ' ') // знак диаметра: «Ø6.5» ищется как «6.5»
      .replace(/(\d),(\d)/g, '$1.$2') // 6,5 → 6.5
      .replace(/(\d)\s*[xх×*]\s*(?=\d)/g, '$1x'), // 12 х 50 → 12x50
  )
    .map((ch) => HOMOGLYPHS[ch] ?? ch)
    .join('')
}

/** Кэш разбора текста полей: справочник ищется на каждое нажатие, а тексты элементов не меняются */
const TOKEN_CACHE = new Map<string, string[]>()
const TOKEN_CACHE_LIMIT = 50_000

function tokenizeCached(text: string): string[] {
  const hit = TOKEN_CACHE.get(text)
  if (hit) return hit
  if (TOKEN_CACHE.size >= TOKEN_CACHE_LIMIT) TOKEN_CACHE.clear()
  const tokens = tokenize(text)
  TOKEN_CACHE.set(text, tokens)
  return tokens
}

/** Токены: слова и числа; «m12x50» даёт ещё и «m12», «50» — размеры ищутся и целиком, и по частям */
export function tokenize(text: string): string[] {
  const out: string[] = []
  for (const raw of normalizeForSearch(text).split(/[^\p{L}\p{N}.]+/u)) {
    const t = raw.replace(/^\.+|\.+$/g, '')
    if (!t) continue
    out.push(t)
    if (/\dx\d/.test(t)) out.push(...t.split('x').filter(Boolean))
    // Обозначение с буквами и цифрами («m12», «r6m5») — ещё и числами из него
    if (/\p{L}/u.test(t) && /\d/.test(t)) out.push(...(t.match(/\d+(\.\d+)?/g) ?? []))
  }
  return [...new Set(out)]
}

const isNumber = (t: string) => /^\d+(\.\d+)?$/.test(t)

/* ------------------------------ сравнение ------------------------------ */

export type MatchKind = 'exact' | 'prefix' | 'fuzzy'

/** Насколько токен запроса совпадает с токеном поля: 0..1. fuzzy=false — без опечаток */
export function tokenScore(q: string, t: string, fuzzy = true): { score: number; kind: MatchKind } | null {
  if (q === t) return { score: 1, kind: 'exact' }
  if (isNumber(q) && isNumber(t)) return Number(q) === Number(t) ? { score: 1, kind: 'exact' } : null
  if (isNumber(q) || isNumber(t)) return null
  if (q.length >= 2 && t.startsWith(q)) return { score: 0.85, kind: 'prefix' } // сокращение
  if (t.length >= 3 && q.startsWith(t)) return { score: 0.7, kind: 'prefix' }
  if (fuzzy && q.length >= 4) {
    const s = similarity(q, t)
    if (s >= 0.75) return { score: s * 0.8, kind: 'fuzzy' } // опечатка
  }
  return null
}

/* ----------------------------- разбор запроса ----------------------------- */

export interface QueryProperty {
  attributeId: string
  label: string
  value: string
}

export interface ParsedQuery {
  /** Свободный текст (наименование) */
  text: string
  /** «Свойство: значение» — части запроса, привязанные к атрибутам */
  properties: QueryProperty[]
}

/** Атрибут по человеческому названию: точное, начало слова или опечатка */
export function findAttributeByLabel(label: string, attributes: readonly CatalogAttribute[]): CatalogAttribute | undefined {
  const l = normalizeForSearch(label.trim())
  if (!l) return undefined
  return (
    attributes.find((a) => normalizeForSearch(a.name) === l || a.id.toLowerCase() === l) ??
    attributes.find((a) => normalizeForSearch(a.name).startsWith(l)) ??
    attributes.find((a) => similarity(normalizeForSearch(a.name), l) >= 0.75)
  )
}

/** Части через «;» вида «Свойство: значение» (или «=») становятся свойствами, остальное — текстом */
export function parseQuery(query: string, attributes: readonly CatalogAttribute[]): ParsedQuery {
  const text: string[] = []
  const properties: QueryProperty[] = []
  for (const chunk of query.split(';')) {
    const m = /^\s*([^:=]{2,40})\s*[:=]\s*(.+)$/.exec(chunk)
    const attr = m?.[1] ? findAttributeByLabel(m[1], attributes) : undefined
    if (m?.[2] && attr) properties.push({ attributeId: attr.id, label: attr.name, value: m[2].trim() })
    else if (chunk.trim()) text.push(chunk.trim())
  }
  return { text: text.join(' '), properties }
}

/* -------------------------------- поиск -------------------------------- */

export interface SearchField {
  id: string
  label: string
  text: string
  /** Вес поля: наименование и шифры важнее прочих свойств */
  weight: number
}

export interface MatchedToken {
  token: string
  fieldId: string
  fieldLabel: string
  kind: MatchKind
}

export interface SmartHit<T> {
  item: T
  /** 0..1 */
  score: number
  matched: MatchedToken[]
  /** Доля слов запроса, которые нашлись */
  coverage: number
}

export interface SmartSearchOptions {
  /** Минимальный балл кандидата */
  threshold?: number
  limit?: number
  /**
   * Строгий режим («все слова»): каждое слово запроса должно найтись — целиком или как начало слова,
   * без опечаток. Для фильтра таблиц; неточный режим — ранжирование с опечатками.
   */
  requireAll?: boolean
}

/** Лучшее совпадение токена среди полей (или среди одного поля для свойства) */
function bestMatch(q: string, fields: readonly { field: SearchField; tokens: string[] }[], fuzzy = true): (MatchedToken & { score: number }) | null {
  let best: (MatchedToken & { score: number }) | null = null
  for (const { field, tokens } of fields) {
    for (const t of tokens) {
      const r = tokenScore(q, t, fuzzy)
      if (r && (!best || r.score * field.weight > best.score)) {
        best = { token: q, fieldId: field.id, fieldLabel: field.label, kind: r.kind, score: r.score * field.weight }
      }
    }
  }
  return best
}

/**
 * Ранжированный поиск. fieldsOf — поля элемента для поиска (атрибуты в текстовом виде, шифры).
 * Свойства запроса ищутся только в своих полях и весят как наименование.
 */
export function smartSearch<T>(
  items: readonly T[],
  fieldsOf: (item: T) => SearchField[],
  query: ParsedQuery,
  { threshold = 0.4, limit = 12, requireAll = false }: SmartSearchOptions = {},
): SmartHit<T>[] {
  const freeTokens = tokenize(query.text)
  const propTokens = query.properties.map((p) => ({ attributeId: p.attributeId, tokens: tokenize(p.value) }))
  const total = freeTokens.length + propTokens.reduce((n, p) => n + p.tokens.length, 0)
  if (total === 0) return []
  const phrase = normalizeForSearch(query.text.trim())

  const hits: SmartHit<T>[] = []
  for (const item of items) {
    const fields = fieldsOf(item).map((field) => ({ field, tokens: tokenizeCached(field.text) }))
    let sum = 0
    const matched: MatchedToken[] = []

    let missed = false
    for (const q of freeTokens) {
      const m = bestMatch(q, fields, !requireAll)
      if (!m) missed = true
      if (m) {
        sum += m.score
        matched.push({ token: m.token, fieldId: m.fieldId, fieldLabel: m.fieldLabel, kind: m.kind })
      }
    }
    for (const p of propTokens) {
      const own = fields.filter((f) => f.field.id === p.attributeId)
      for (const q of p.tokens) {
        const m = bestMatch(q, own, !requireAll)
        if (!m) missed = true
        if (m) {
          sum += m.score / (own[0]?.field.weight ?? 1) // свойство весит полностью
          matched.push({ token: m.token, fieldId: m.fieldId, fieldLabel: m.fieldLabel, kind: m.kind })
        }
      }
    }

    let score = sum / total
    // Фраза целиком внутри наименования — почти наверняка тот самый элемент
    const name = fields[0]?.field.text ?? ''
    if (phrase.length >= 3 && normalizeForSearch(name).includes(phrase)) score = Math.min(1, score + 0.15)
    if (requireAll ? !missed : score >= threshold) hits.push({ item, score, matched, coverage: matched.length / total })
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit)
}

/* ---------------------- черновик элемента из запроса ---------------------- */

export interface DraftFromQuery {
  values: Record<string, AttributeValue>
  /** Какие атрибуты заполнены автоматически — подсветить пользователю */
  filled: string[]
}

function convert(attr: CatalogAttribute, raw: string, refs: readonly ReferenceValue[]): AttributeValue | undefined {
  const v = raw.trim()
  switch (attr.type) {
    case 'int': {
      const n = Number.parseInt(v.replace(/\s/g, ''), 10)
      return Number.isFinite(n) ? n : undefined
    }
    case 'float': {
      const n = Number.parseFloat(v.replace(/\s/g, '').replace(',', '.'))
      return Number.isFinite(n) ? n : undefined
    }
    case 'string':
      return v
    case 'datetime': {
      const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v)
      return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))).toISOString() : undefined
    }
    case 'reference': {
      const q = normalizeForSearch(v)
      return refs.find((r) => normalizeForSearch(r.display) === q) ?? refs.find((r) => normalizeForSearch(r.display).startsWith(q))
    }
    default:
      return undefined
  }
}

/**
 * Разобрать запрос в значения атрибутов нового элемента:
 *  «Свойство: значение» → значение атрибута (с приведением типа);
 *  слово, совпадающее со значением ссылочного атрибута (напр. «шт») → ссылка;
 *  остальное → атрибут-наименование.
 */
export function draftFromQuery(
  query: string,
  attributes: readonly CatalogAttribute[],
  displayAttributeId: string,
  referenceOptions: Readonly<Record<string, readonly ReferenceValue[]>> = {},
): DraftFromQuery {
  const parsed = parseQuery(query, attributes)
  const values: Record<string, AttributeValue> = {}
  const filled: string[] = []

  for (const p of parsed.properties) {
    const attr = attributes.find((a) => a.id === p.attributeId)
    const v = attr ? convert(attr, p.value, referenceOptions[attr.id] ?? []) : undefined
    if (attr && v !== undefined) {
      values[attr.id] = v
      filled.push(attr.id)
    }
  }

  // Неявные ссылки: отдельное слово = подпись варианта («шт», «кг»)
  let rest = parsed.text
  for (const attr of attributes) {
    if (attr.type !== 'reference' || values[attr.id] !== undefined) continue
    for (const ref of referenceOptions[attr.id] ?? []) {
      const re = new RegExp(`(^|[\\s,])${ref.display.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?(?=[\\s,]|$)`, 'iu')
      if (re.test(rest)) {
        values[attr.id] = ref
        filled.push(attr.id)
        rest = rest.replace(re, '$1')
        break
      }
    }
  }

  const name = rest.replace(/\s+/g, ' ').replace(/[\s,]+$/, '').trim()
  if (name && values[displayAttributeId] === undefined) {
    values[displayAttributeId] = name
    filled.push(displayAttributeId)
  }
  return { values, filled }
}
