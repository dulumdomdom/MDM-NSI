// Расшифровка шифра (ТЗ): по каталогу и шифру выбирается ПЕРВАЯ структура расшифровки,
// у которой выполнены все условия; иначе — расшифровка по умолчанию (все фасеты через пробел).
// Наименования значений берутся из ЭФФЕКТИВНЫХ options — так расшифровка частично зависит от шифра.

import type { Classifier, DecodePart, DecodeStructure } from '@/types'
import { evaluateCondition } from './conditions'
import { parseCode, type ParseResult, type ParsedFacet } from './parser'
import { getCatalog } from './structure'

export interface DecodedPart {
  facetId: string
  label: string
  code: string
  /** Наименование значения (из options) или само значение */
  name: string
}

export interface DecodeResult {
  text: string
  /** null — расшифровка по умолчанию */
  structureId: string | null
  structureName: string
  parts: DecodedPart[]
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim()

export function decodedPart(f: ParsedFacet): DecodedPart {
  const option = f.options?.find((o) => o.code === f.value)
  return { facetId: f.facetId, label: f.label, code: f.value, name: option?.name ?? f.value }
}

/** Подходит ли структура: все условия выполнены на заполненных значениях */
export function structureMatches(s: DecodeStructure, values: Readonly<Record<string, string>>): boolean {
  return s.conditions.every((c) => {
    const v = values[c.facetId]
    return v !== undefined && v !== '' && evaluateCondition(c.condition, v)
  })
}

function renderPart(p: DecodePart, parts: Map<string, DecodedPart>): string {
  if (p.kind === 'text') return p.text
  const d = parts.get(p.facetId)
  if (!d) return ''
  const body = p.format === 'code' ? d.code : p.format === 'label-name' ? `${d.label} ${d.name}` : d.name
  const head = [p.prefix, body].filter(Boolean).join(' ')
  // Знак препинания в суффиксе прилегает к значению: «исполнение 1,», а не «исполнение 1 ,»
  if (!p.suffix) return head
  return /^[,.;:]/.test(p.suffix) ? head + p.suffix : `${head} ${p.suffix}`
}

export function decode(classifier: Classifier, parsed: ParseResult): DecodeResult {
  const decoded = parsed.facets.filter((f) => f.visible && f.value !== '').map(decodedPart)
  const byId = new Map(decoded.map((d) => [d.facetId, d]))
  const structures = getCatalog(classifier, parsed.catalogId)?.decodeStructures ?? []
  const match = structures.find((s) => structureMatches(s, parsed.values))

  if (!match) {
    return {
      text: collapse(decoded.map((d) => d.name).join(' ')),
      structureId: null,
      structureName: 'По умолчанию',
      parts: decoded,
    }
  }
  const pieces = match.parts.map((p) => renderPart(p, byId)).filter((s) => s.trim() !== '')
  return { text: collapse(pieces.join(' ')), structureId: match.id, structureName: match.name, parts: decoded }
}

/** Удобная обёртка: каталог + шифр → расшифровка (как сформулировано в ТЗ) */
export function decodeCode(classifier: Classifier, catalogId: string, code: string): DecodeResult {
  return decode(classifier, parseCode(classifier, catalogId, code))
}
