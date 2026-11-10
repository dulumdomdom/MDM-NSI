// Атрибуты справочников: группировка типов для UI, значения по умолчанию, валидация, форматирование.
// Чистые функции — их используют useDynamicForm/useDynamicTable, поиск и экспорт.

import type { AttributeKind, AttributeType, AttributeValue, BlobValue, CatalogAttribute, ReferenceValue } from '@/types'

const KIND: Record<AttributeType, AttributeKind> = {
  int: 'number',
  float: 'number',
  string: 'string',
  datetime: 'datetime',
  blob: 'blob',
  composite: 'composite',
  reference: 'reference',
}

/** Тип атрибута → UI-группа (по ней выбирается ячейка/поле) */
export const attributeKind = (type: AttributeType): AttributeKind => KIND[type]

export const isBlobValue = (v: AttributeValue | undefined): v is BlobValue =>
  typeof v === 'object' && v !== null && 'fileName' in v && typeof v.fileName === 'string'

export const isReferenceValue = (v: AttributeValue | undefined): v is ReferenceValue =>
  typeof v === 'object' && v !== null && 'elementId' in v && typeof v.elementId === 'string'

/** Короткий текст значения без форматирования (подписи групп, ссылки, сверка) */
export function textOf(v: AttributeValue | undefined, fallback = ''): string {
  if (typeof v === 'string') return v || fallback
  if (typeof v === 'number') return String(v)
  if (isReferenceValue(v)) return v.display
  if (isBlobValue(v)) return v.fileName
  return fallback
}

export type CompositeValue = { [fieldId: string]: AttributeValue }

export const isCompositeValue = (v: AttributeValue | undefined): v is CompositeValue =>
  typeof v === 'object' && v !== null && !isBlobValue(v) && !isReferenceValue(v)

export function defaultValue(attr: CatalogAttribute): AttributeValue {
  if (attr.type === 'composite') {
    return Object.fromEntries((attr.compositeFields ?? []).map((f) => [f.id, defaultValue(f)]))
  }
  return null
}

const isEmpty = (v: AttributeValue | undefined): boolean => v === null || v === undefined || v === ''

/** Ошибка валидации значения или null. Для составных — ключи вида «address.city» */
export function validateAttribute(attr: CatalogAttribute, value: AttributeValue | undefined): Record<string, string> {
  const errors: Record<string, string> = {}
  const set = (msg: string) => (errors[attr.id] = msg)

  if (attr.type === 'composite') {
    const v = isCompositeValue(value) ? value : {}
    for (const f of attr.compositeFields ?? []) {
      for (const [k, msg] of Object.entries(validateAttribute(f, v[f.id]))) errors[`${attr.id}.${k}`] = msg
    }
    return errors
  }
  if (isEmpty(value)) {
    if (attr.required) set('Обязательное поле')
    return errors
  }
  switch (attr.type) {
    case 'int':
    case 'float': {
      if (typeof value !== 'number' || Number.isNaN(value)) set('Ожидается число')
      else if (attr.type === 'int' && !Number.isInteger(value)) set('Ожидается целое число')
      else if (attr.min !== undefined && value < attr.min) set(`Не меньше ${attr.min}`)
      else if (attr.max !== undefined && value > attr.max) set(`Не больше ${attr.max}`)
      break
    }
    case 'string': {
      const s = textOf(value)
      if (attr.maxLength !== undefined && s.length > attr.maxLength) set(`Не длиннее ${attr.maxLength} символов`)
      else if (attr.pattern && !new RegExp(attr.pattern, 'u').test(s)) set('Неверный формат')
      break
    }
    case 'datetime':
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) set('Неверная дата')
      break
    case 'blob':
      if (!isBlobValue(value)) set('Ожидается файл')
      break
    case 'reference':
      if (!isReferenceValue(value)) set('Выберите элемент справочника')
      break
  }
  return errors
}

export function validateAll(attrs: readonly CatalogAttribute[], values: Readonly<Record<string, AttributeValue>>): Record<string, string> {
  return Object.assign({}, ...attrs.map((a) => validateAttribute(a, values[a.id]))) as Record<string, string>
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
const numFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 })

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

/** Текстовое представление значения (таблица, поиск, экспорт) */
export function formatAttribute(attr: CatalogAttribute, value: AttributeValue | undefined): string {
  if (isEmpty(value) || value === undefined) return ''
  switch (attr.type) {
    case 'int':
    case 'float':
      return typeof value === 'number' ? numFmt.format(value) : String(value as string)
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? dateFmt.format(new Date(value)) : ''
    case 'blob':
      return isBlobValue(value) ? value.fileName : ''
    case 'reference':
      return isReferenceValue(value) ? value.display : ''
    case 'composite': {
      const v = isCompositeValue(value) ? value : {}
      return (attr.compositeFields ?? [])
        .map((f) => formatAttribute(f, v[f.id]))
        .filter((s) => s !== '')
        .join(', ')
    }
    default:
      return typeof value === 'string' ? value : ''
  }
}
