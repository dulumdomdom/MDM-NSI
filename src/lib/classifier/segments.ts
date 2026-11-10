// Разметка строки шифра на сегменты для отображения: фасеты, разделители, неразобранный остаток.
// Склейка text всех сегментов = исходный шифр (пустые фасеты — сегменты без текста).

import type { ReadDirection } from '@/types'
import type { ParsedFacet, ParseResult } from './parser'

export type CodeSegment =
  | { kind: 'facet'; facet: ParsedFacet; text: string }
  | { kind: 'sep'; text: string }
  | { kind: 'rest'; text: string }

/** Сегменты в порядке символов строки (для rtl фасеты идут в обратном порядке чтения) */
export function codeSegments(result: ParseResult, dir: ReadDirection): CodeSegment[] {
  const chars = Array.from(result.code)
  const visible = result.facets.filter((f) => f.visible)
  const ordered = dir === 'rtl' ? [...visible].reverse() : visible
  const delimChars = new Set(
    result.facets.flatMap((f) => (f.config.lengthMode === 'delimiter' && f.config.delimiter ? Array.from(f.config.delimiter) : [])),
  )

  const out: CodeSegment[] = []
  let cursor = 0
  // Промежуток между фасетами: только символы разделителей — sep, иначе — лишние символы
  const pushGap = (to: number): void => {
    if (to <= cursor) return
    const text = chars.slice(cursor, to).join('')
    out.push({ kind: Array.from(text).every((ch) => delimChars.has(ch)) ? 'sep' : 'rest', text })
    cursor = to
  }

  for (const f of ordered) {
    if (f.span) {
      pushGap(f.span.start)
      out.push({ kind: 'facet', facet: f, text: chars.slice(f.span.start, f.span.end).join('') })
      cursor = Math.max(cursor, f.span.end)
    } else {
      out.push({ kind: 'facet', facet: f, text: '' })
    }
  }
  pushGap(chars.length)
  return out
}

/** Заглушка пустого фасета: точки по ожидаемой длине (fixed) или многоточие */
export function facetPlaceholder(f: ParsedFacet): string {
  if (f.config.lengthMode === 'fixed') return '·'.repeat(Math.max(1, f.config.fixedLength ?? f.config.defaultLength))
  return '···'
}
