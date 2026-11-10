import { describe, expect, it } from 'vitest'
import { toolClassifier } from '@/mocks/data/classifiers/tool'
import { analyzeValues, parseCode } from '../parser'
import { codeSegments, facetPlaceholder } from '../segments'
import { DRILL_CODE, fixedOnly } from './fixtures'

describe('codeSegments', () => {
  it('склейка сегментов даёт исходный шифр; rtl — группа справа', () => {
    const segs = codeSegments(parseCode(toolClassifier, 'cat-cutting', DRILL_CODE), 'rtl')
    expect(segs.map((s) => s.text).join('')).toBe(DRILL_CODE)
    const last = segs[segs.length - 1]
    expect(last?.kind === 'facet' && last.facet.facetId).toBe('f-group')
    expect(segs.filter((s) => s.kind === 'sep').map((s) => s.text)).toEqual(['-', '-'])
  })

  it('лишние символы — сегмент rest', () => {
    const segs = codeSegments(parseCode(fixedOnly, 'cat', 'QWERTY'), 'ltr')
    expect(segs.at(-1)).toEqual({ kind: 'rest', text: 'RTY' })
  })

  it('пустые фасеты — сегменты без текста с заглушкой по длине', () => {
    const segs = codeSegments(analyzeValues(toolClassifier, 'cat-cutting', { 'f-group': 'SV' }), 'rtl')
    const empty = segs.filter((s) => s.kind === 'facet' && s.text === '')
    expect(empty.length).toBeGreaterThan(5)
    const first = empty[0]
    if (first?.kind !== 'facet') throw new Error('ожидался фасет')
    expect(facetPlaceholder(first.facet)).toMatch(/^·+$|^···$/)
  })
})
