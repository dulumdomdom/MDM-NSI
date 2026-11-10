// Справочники: схема атрибутов, состояния, элементы, история, сопоставления.

import type { IsoDateTime } from './common'
import type { ExternalRef } from './integration'

/**
 * Типы атрибутов. По ТЗ — 6 групп: числовые (int/float), строка, дата-время,
 * файл (BLOB), составной, ссылочный. Числовые разделены для валидации.
 */
export type AttributeType = 'int' | 'float' | 'string' | 'datetime' | 'blob' | 'composite' | 'reference'

/** UI-группа атрибута: по ней выбираются ячейка и поле ввода (по 1 компоненту на группу) */
export type AttributeKind = 'number' | 'string' | 'datetime' | 'blob' | 'composite' | 'reference'

export interface CatalogAttribute {
  id: string
  name: string
  type: AttributeType
  required: boolean
  /** Для type = 'reference' */
  referenceCatalogId?: string
  /** Какой атрибут целевого справочника показывать как подпись ссылки */
  referenceDisplayAttributeId?: string
  /** Для type = 'composite' — пользовательский тип из существующих */
  compositeFields?: CatalogAttribute[]
  /** Валидация: строки */
  maxLength?: number
  pattern?: string
  /** Валидация: числа */
  min?: number
  max?: number
  /** Ширина колонки в таблице, px */
  width?: number
  /** Показывать в таблице (по умолчанию true) */
  listed?: boolean
}

/** Состояние элемента. Набор состояний свой у каждого справочника */
export interface CatalogState {
  id: string
  name: string
  color: 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast'
  /** Состояние, присваиваемое новому элементу */
  initial?: boolean
}

/**
 * Привязка классификатора к справочнику: элементам справочника присваиваются шифры этого классификатора.
 * У справочника может быть несколько привязок (например, классификатор инструмента и ОКПД2).
 */
export interface ClassifierBinding {
  classifierId: string
  /** Каталог классификатора, в котором подбирается шифр (если не задан — выбирается при присвоении) */
  classifierCatalogId?: string
  /** Шифр обязателен для элемента (элементы без него подсвечиваются) */
  required: boolean
  /** Предлагать краткое наименование шифра как наименование элемента */
  suggestName?: boolean
}

export interface Catalog {
  id: string
  name: string
  description?: string
  attributes: CatalogAttribute[]
  states: CatalogState[]
  /** Режим иерархии: элементы-группы и перенос между группами */
  hierarchical: boolean
  /** Атрибут-наименование: для ссылок, поиска, сверки */
  displayAttributeId: string
  /** Классификаторы, шифры которых присваиваются элементам */
  classifierBindings: ClassifierBinding[]
}

export interface CatalogSummary {
  id: string
  name: string
  description?: string
  hierarchical: boolean
  elementCount: number
  attributeCount: number
  /** Сколько классификаторов привязано */
  classifierCount: number
}

/** Значение файла (BLOB) — в элементе хранятся только метаданные, контент — отдельным запросом */
export interface BlobValue {
  fileName: string
  size: number
  mimeType: string
  url?: string
}

/** Значение ссылки на элемент другого справочника */
export interface ReferenceValue {
  catalogId: string
  elementId: string
  /** Денормализованная подпись — чтобы не грузить целевой справочник для отображения */
  display: string
}

/** Значение атрибута любого типа */
export type AttributeValue =
  | number
  | string
  | null
  | BlobValue
  | ReferenceValue
  | { [fieldId: string]: AttributeValue }

/**
 * История редактирования — 3 типа (Приложение №1 к ТЗ недоступно; принятое допущение):
 *  - attribute — изменение значения атрибута (было → стало);
 *  - state     — смена состояния элемента;
 *  - version   — полный снимок элемента (версия).
 */
export type EditHistory =
  | {
      type: 'attribute'
      id: string
      at: IsoDateTime
      userId: string
      attributeId: string
      oldValue: AttributeValue
      newValue: AttributeValue
    }
  | { type: 'state'; id: string; at: IsoDateTime; userId: string; fromState: string; toState: string; comment?: string }
  | { type: 'version'; id: string; at: IsoDateTime; userId: string; version: number; snapshot: Record<string, AttributeValue> }

export type EditHistoryType = EditHistory['type']

/** Виды сопоставления элементов (ТЗ: синонимы, аналоги, давальческие, сертифицированные) */
export type MatchType = 'synonym' | 'analog' | 'supplier' | 'certified'

export interface ElementMatch {
  type: MatchType
  catalogId: string
  elementId: string
  display: string
}

/** Статус присвоенного шифра: проходит согласование по обходному листу */
export type ElementCodeStatus = 'on_approval' | 'approved' | 'rejected'

/** Шифр классификатора, присвоенный элементу справочника */
export interface ElementCode {
  classifierId: string
  /** Каталог классификатора */
  catalogId: string
  code: string
  decoded: string
  shortName: string
  status: ElementCodeStatus
  /** Заявка (обходной лист), по которой согласуется шифр */
  requestId?: string
  assignedBy: string
  assignedAt: IsoDateTime
}

export interface CatalogElement {
  id: string
  catalogId: string
  attributes: Record<string, AttributeValue>
  state: string
  /** Иерархия: id родительской группы */
  parentId?: string
  /** Элемент — группа (только в иерархических справочниках) */
  isGroup?: boolean
  history: EditHistory[]
  matches?: ElementMatch[]
  /** Шифры по привязанным классификаторам — не более одного на классификатор */
  codes?: ElementCode[]
  /** Идентификаторы во внешних системах (1С, Imbase, АСУ) и состояние синхронизации */
  externalRefs?: ExternalRef[]
}

/** Режимы поиска (ТЗ): контекстный, неточный, по маске */
export type SearchMode = 'context' | 'fuzzy' | 'mask'
