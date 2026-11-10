// Схема справочника: создание, проверка целостности. Чистые функции.

import type { AttributeType, Catalog, CatalogAttribute, CatalogState } from '@/types'
import { uniqueId } from './ids'

export const ATTRIBUTE_TYPES: { type: AttributeType; label: string }[] = [
  { type: 'string', label: 'Строка' },
  { type: 'int', label: 'Целое число' },
  { type: 'float', label: 'Дробное число' },
  { type: 'datetime', label: 'Дата и время' },
  { type: 'blob', label: 'Файл' },
  { type: 'reference', label: 'Ссылка на справочник' },
  { type: 'composite', label: 'Составной' },
]

export const STATE_COLORS: { value: CatalogState['color']; label: string }[] = [
  { value: 'success', label: 'Зелёный' },
  { value: 'info', label: 'Синий' },
  { value: 'warn', label: 'Жёлтый' },
  { value: 'danger', label: 'Красный' },
  { value: 'secondary', label: 'Серый' },
  { value: 'contrast', label: 'Тёмный' },
]

export function newAttribute(name: string, taken: Iterable<string>, type: AttributeType = 'string'): CatalogAttribute {
  const attr: CatalogAttribute = { id: uniqueId('', name, taken), name, type, required: false }
  if (type === 'composite') attr.compositeFields = []
  return attr
}

/** Новый справочник: наименование + два базовых состояния */
export function newCatalog(id: string, name: string): Catalog {
  return {
    id,
    name,
    hierarchical: false,
    displayAttributeId: 'name',
    attributes: [{ id: 'name', name: 'Наименование', type: 'string', required: true, width: 300 }],
    states: [
      { id: 'draft', name: 'Черновик', color: 'secondary', initial: true },
      { id: 'active', name: 'Действует', color: 'success' },
      { id: 'archived', name: 'Архив', color: 'contrast' },
    ],
    classifierBindings: [],
  }
}

export interface SchemaIssue {
  where: string
  message: string
}

export function validateCatalog(c: Catalog, knownCatalogIds: readonly string[] = [], knownClassifierIds: readonly string[] = []): SchemaIssue[] {
  const issues: SchemaIssue[] = []
  const add = (where: string, message: string) => issues.push({ where, message })

  if (!c.name.trim()) add('Справочник', 'Не задано наименование')
  if (c.attributes.length === 0) add('Атрибуты', 'Нет ни одного атрибута')
  const ids = new Set<string>()
  const checkAttrs = (attrs: CatalogAttribute[], prefix: string): void => {
    for (const a of attrs) {
      const where = `${prefix}«${a.name || a.id}»`
      if (!a.id) add(where, 'Не задан идентификатор')
      if (!a.name.trim()) add(where, 'Не задано наименование')
      if (a.type === 'reference' && !a.referenceCatalogId) add(where, 'Не выбран справочник для ссылки')
      if (a.type === 'reference' && a.referenceCatalogId && knownCatalogIds.length && !knownCatalogIds.includes(a.referenceCatalogId))
        add(where, 'Ссылка на несуществующий справочник')
      if (a.type === 'composite') {
        if (!a.compositeFields?.length) add(where, 'Составной тип без полей')
        else checkAttrs(a.compositeFields, `${where} → `)
      }
      if (a.min !== undefined && a.max !== undefined && a.min > a.max) add(where, 'Минимум больше максимума')
      if (a.pattern) {
        try {
          new RegExp(a.pattern, 'u')
        } catch {
          add(where, 'Неверный шаблон проверки')
        }
      }
    }
  }
  for (const a of c.attributes) {
    if (ids.has(a.id)) add(`Атрибут «${a.name}»`, 'Повторяется идентификатор')
    ids.add(a.id)
  }
  checkAttrs(c.attributes, 'Атрибут ')
  if (!ids.has(c.displayAttributeId)) add('Справочник', 'Атрибут-наименование не найден среди атрибутов')

  if (c.states.length === 0) add('Состояния', 'Нет ни одного состояния')
  if (c.states.filter((s) => s.initial).length !== 1) add('Состояния', 'Должно быть ровно одно начальное состояние')
  if (new Set(c.states.map((s) => s.id)).size !== c.states.length) add('Состояния', 'Повторяются идентификаторы')

  const bound = new Set<string>()
  for (const b of c.classifierBindings) {
    if (bound.has(b.classifierId)) add('Классификаторы', 'Классификатор привязан дважды')
    bound.add(b.classifierId)
    if (knownClassifierIds.length && !knownClassifierIds.includes(b.classifierId)) add('Классификаторы', `Неизвестный классификатор ${b.classifierId}`)
  }
  return issues
}
