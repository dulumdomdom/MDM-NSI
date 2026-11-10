// Мок-данные = types/ 1:1 и согласованы с движком: сид-шифры разбираются без ошибок.

import { describe, expect, it } from 'vitest'
import { decodeCode, parseCode, validateClassifier, validateRules } from '@/lib/classifier'
import { catalogs, catalogElements } from '../data/catalogs'
import { allClassifiers } from '../data/classifiers'
import { toolClassifier } from '../data/classifiers/tool'
import { classifierEntries, requests } from '../data/requests'

const classifierOf = (id: string) => {
  const c = allClassifiers.find((x) => x.id === id)
  if (!c) throw new Error(id)
  return c
}

describe('мок-данные', () => {
  it('сложный классификатор: ≥ 10 фасетов в пути и ≥ 3 правил', () => {
    const r = parseCode(toolClassifier, 'cat-cutting', classifierEntries[0]?.code ?? '')
    expect(r.facets.length).toBeGreaterThanOrEqual(10)
    for (const c of allClassifiers) {
      expect(validateRules(c)).toEqual([])
      expect(validateClassifier(c)).toEqual([])
    }
  })

  it('утверждённые записи: шифр валиден, расшифровка совпадает', () => {
    for (const e of classifierEntries) {
      const c = classifierOf(e.classifierId)
      expect(parseCode(c, e.catalogId, e.code).issues).toEqual([])
      expect(decodeCode(c, e.catalogId, e.code).text).toBe(e.decoded)
    }
  })

  it('шифры в заявках валидны', () => {
    for (const r of requests.filter((x) => x.payload.code)) {
      const code = String(r.payload['code'])
      const catalogId = String(r.payload['catalogId'])
      expect(parseCode(classifierOf(r.targetId), catalogId, code).issues).toEqual([])
      expect(decodeCode(classifierOf(r.targetId), catalogId, code).text).toBe(r.payload['decoded'])
    }
  })

  it('шифры элементов валидны и расшифрованы движком', () => {
    for (const el of catalogElements) {
      for (const c of el.codes ?? []) {
        const cls = classifierOf(c.classifierId)
        expect(parseCode(cls, c.catalogId, c.code).issues).toEqual([])
        expect(decodeCode(cls, c.catalogId, c.code).text).toBe(c.decoded)
      }
    }
  })

  it('элементы ссылаются только на существующие справочники и атрибуты', () => {
    const ids = new Set(catalogs.map((c) => c.id))
    for (const el of catalogElements) {
      expect(ids.has(el.catalogId)).toBe(true)
      const attrs = new Set(catalogs.find((c) => c.id === el.catalogId)?.attributes.map((a) => a.id))
      for (const key of Object.keys(el.attributes)) expect(attrs.has(key)).toBe(true)
    }
  })

  it('есть иерархический справочник со ссылкой и справочник с составным атрибутом', () => {
    expect(catalogs.some((c) => c.hierarchical && c.attributes.some((a) => a.type === 'reference'))).toBe(true)
    expect(catalogs.some((c) => c.attributes.some((a) => a.type === 'composite'))).toBe(true)
  })
})
