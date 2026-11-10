// Автогенерация краткого наименования по правилу из конфига классификатора.
// Синтаксис шаблона: {facetId} — наименование, {facetId:code} — код, [ ... ] — необязательный блок.

import type { ShortNameRule } from '@/types'
import type { DecodedPart } from './decoder'

const PLACEHOLDER = /\{([\w-]+)(?::(code|name))?\}/g
const OPTIONAL_BLOCK = /\[([^\]]*)\]/g

/** Подставить плейсхолдеры; вернуть null, если хоть один пуст (для необязательных блоков) */
function fill(fragment: string, parts: Map<string, DecodedPart>, allowed: Set<string>): string | null {
  let missing = false
  const out = fragment.replace(PLACEHOLDER, (_m, id: string, fmt: string | undefined) => {
    const p = allowed.has(id) ? parts.get(id) : undefined
    const v = p ? (fmt === 'code' ? p.code : p.name) : ''
    if (v === '') missing = true
    return v
  })
  return missing ? null : out
}

function applyCase(s: string, mode: NonNullable<ShortNameRule['normalize']>['case']): string {
  switch (mode) {
    case 'upper':
      return s.toUpperCase()
    case 'lower':
      return s.toLowerCase()
    case 'sentence':
      return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    default:
      return s
  }
}

export function buildShortName(rule: ShortNameRule, decoded: DecodedPart[]): string {
  const parts = new Map(decoded.map((d) => [d.facetId, d]))
  const allowed = new Set(rule.facetIds)
  // 1) необязательные блоки — целиком или ничего
  const withBlocks = rule.template.replace(OPTIONAL_BLOCK, (_m, inner: string) => fill(inner, parts, allowed) ?? '')
  // 2) оставшиеся плейсхолдеры — пустые просто выпадают
  const filled = withBlocks.replace(PLACEHOLDER, (_m, id: string, fmt: string | undefined) => {
    const p = allowed.has(id) ? parts.get(id) : undefined
    return p ? (fmt === 'code' ? p.code : p.name) : ''
  })
  // 3) нормализация: пробелы, висячие разделители, регистр, длина
  let s = filled
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/^[\s,.;:-]+|[\s,;:-]+$/g, '')
  s = applyCase(s, rule.normalize?.case)
  const max = rule.normalize?.maxLength
  if (max !== undefined && s.length > max) s = s.slice(0, max).trimEnd()
  return s
}
