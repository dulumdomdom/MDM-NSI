// Все классификаторы моков и помощник для сид-шифров элементов: расшифровка и краткое наименование
// считаются тем же движком, что и в интерфейсе, — данные не расходятся с конфигурацией.

import { buildShortName, decode, parseCode } from '@/lib/classifier'
import type { Classifier, ElementCode } from '@/types'
import { eskdClassifier } from './eskd'
import { fastenerClassifier } from './fastener'
import { materialClassifier } from './material'
import { okpd2Classifier } from './okpd2'
import { toolClassifier } from './tool'

export const allClassifiers: Classifier[] = [toolClassifier, fastenerClassifier, materialClassifier, okpd2Classifier, eskdClassifier]

/** Утверждённый шифр элемента. Невалидный сид-шифр — ошибка сразу при загрузке моков */
export function seedCode(classifierId: string, catalogId: string, code: string, assignedBy: string, assignedAt: string): ElementCode {
  const cls = allClassifiers.find((c) => c.id === classifierId)
  if (!cls) throw new Error(`Классификатор ${classifierId} не найден`)
  const parsed = parseCode(cls, catalogId, code)
  if (!parsed.valid) throw new Error(`Сид-шифр ${code}: ${parsed.issues.map((i) => i.message).join('; ')}`)
  const decoded = decode(cls, parsed)
  return {
    classifierId,
    catalogId,
    code,
    decoded: decoded.text,
    shortName: cls.shortNameRule ? buildShortName(cls.shortNameRule, decoded.parts) : decoded.text,
    status: 'approved',
    assignedBy,
    assignedAt,
  }
}
