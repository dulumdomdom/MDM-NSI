// Классификаторы: дерево структуры шифра, фасеты, условия переходов, зависимости, расшифровка.
// Всё здесь — ДАННЫЕ конфигурации. Логика работы с ними — в src/lib/classifier (чистые функции).

import type { CodeName } from './common'

/* ------------------------------------------------------------------ */
/* Условия перехода — 12 типов по ТЗ                                   */
/* ------------------------------------------------------------------ */

export type ConditionType =
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'intRange'
  | 'floatRange'
  | 'stringArray'
  | 'intArray'
  | 'floatArray'
  | 'boolArray'
  | 'intRangeArray'
  | 'floatRangeArray'

/** Диапазон, границы включительно */
export interface NumRange {
  min: number
  max: number
}

/** Тип значения условия для каждого типа условия */
export interface ConditionValueMap {
  string: string
  int: number
  float: number
  bool: boolean
  intRange: NumRange
  floatRange: NumRange
  stringArray: string[]
  intArray: number[]
  floatArray: number[]
  boolArray: boolean[]
  intRangeArray: NumRange[]
  floatRangeArray: NumRange[]
}

/** Дискриминированное объединение: type однозначно задаёт тип value (без unknown/any) */
export type TransitionCondition = {
  [K in ConditionType]: { type: K; value: ConditionValueMap[K] }
}[ConditionType]

/* ------------------------------------------------------------------ */
/* Фасеты                                                              */
/* ------------------------------------------------------------------ */

/**
 * Способ определения длины фасета (ТЗ, 3 способа):
 *  - delimiter — по символу(ам) окончания фасета;
 *  - fixed     — по фиксированной длине;
 *  - remainder — последний фасет забирает остаток шифра.
 */
export type FacetLengthMode = 'delimiter' | 'fixed' | 'remainder'

export type FacetDataType = 'string' | 'int' | 'float' | 'bool'

export interface FacetConfig {
  id: string
  name: string
  description?: string
  lengthMode: FacetLengthMode
  /** Для lengthMode = 'fixed' */
  fixedLength?: number
  /** Для lengthMode = 'delimiter' (символ окончания фасета) */
  delimiter?: string
  /** Длина, если ни fixedLength, ни delimiter не заданы. По ТЗ = 1 */
  defaultLength: number
  dataType: FacetDataType
  required: boolean
  /** id смыслового блока (Classifier.sections) */
  section: string
  /** Видимость по умолчанию; может меняться зависимостями */
  visible?: boolean
  /** Допустимые значения. Если не задано — свободный ввод по dataType */
  options?: CodeName[]
  /** Подсказка для ввода в мастере */
  placeholder?: string
  /**
   * Правила зависимостей, где этот фасет — триггер.
   * Хранятся у фасета-триггера (локальность в редакторе); triggerFacetId должен совпадать с id.
   */
  dependencies?: FacetDependencyRule[]
}

/** Переопределение параметров зависимого фасета */
export interface FacetOverride {
  facetId: string
  label?: string
  options?: CodeName[]
  visible?: boolean
}

/**
 * Контекстная зависимость: значение фасета-триггера меняет label/options/visible
 * фасетов, идущих ПОСЛЕ него в пути структуры (M > N).
 */
export interface FacetDependencyRule {
  id: string
  /** Человекочитаемое описание правила (для редактора и подсказок) */
  description?: string
  triggerFacetId: string
  triggerValue: string | number
  /** Если задано — используется вместо точного сравнения с triggerValue (любой из 12 типов) */
  triggerCondition?: TransitionCondition
  overrides: FacetOverride[]
}

/* ------------------------------------------------------------------ */
/* Дерево структуры шифра                                              */
/* ------------------------------------------------------------------ */

/** root → catalog → facet-ноды (по ТЗ: корень делится на каталоги, каталоги — на ноды структур шифра) */
export type StructureNodeKind = 'root' | 'catalog' | 'facet'

export interface StructureNode {
  id: string
  kind: StructureNodeKind
  name: string
  /** Для kind = 'facet' — какой фасет читается в этой ноде */
  facetId?: string
  children: StructureNode[]
  /**
   * Условие перехода в эту ноду из родителя: значение фасета РОДИТЕЛЯ
   * сравнивается с условием. Нет условия — нода выбирается только по умолчанию.
   */
  transitionCondition?: TransitionCondition
  /** Какой ребёнок берётся, если ни одно условие не выполнено. По ТЗ = 0 (первый) */
  defaultChildIndex: number
  /** Для kind = 'catalog' — структуры расшифровки */
  decodeStructures?: DecodeStructure[]
}

/* ------------------------------------------------------------------ */
/* Расшифровка                                                         */
/* ------------------------------------------------------------------ */

/**
 * Часть расшифровки. prefix/suffix у фасета выводятся ТОЛЬКО вместе с его значением —
 * так единицы измерения не «висят», пока фасет не заполнен. text — выводится всегда.
 */
export type DecodePart =
  | { kind: 'facet'; facetId: string; format?: 'name' | 'code' | 'label-name'; prefix?: string; suffix?: string }
  | { kind: 'text'; text: string }

/**
 * Структура расшифровки: выбирается первая, у которой выполнены ВСЕ условия.
 * Если ни одна не подошла — расшифровка по умолчанию (все фасеты через пробел).
 */
export interface DecodeStructure {
  id: string
  name: string
  conditions: { facetId: string; condition: TransitionCondition }[]
  parts: DecodePart[]
}

/* ------------------------------------------------------------------ */
/* Классификатор                                                       */
/* ------------------------------------------------------------------ */

export type ClassifierInputMode = 'direct' | 'wizard'

/** Направление чтения шифра. По ТЗ — справа налево */
export type ReadDirection = 'rtl' | 'ltr'

export interface ClassifierSection {
  id: string
  name: string
  order: number
}

/** Правило автогенерации краткого наименования */
export interface ShortNameRule {
  facetIds: string[]
  /**
   * Шаблон: {facetId} — наименование значения, {facetId:code} — код значения.
   * [ ... ] — необязательный блок: выкидывается целиком, если любой плейсхолдер внутри пуст.
   */
  template: string
  normalize?: {
    case?: 'upper' | 'lower' | 'sentence'
    maxLength?: number
  }
}

export interface Classifier {
  id: string
  name: string
  description?: string
  /** Корень → каталоги → ноды */
  tree: StructureNode
  /** Словарь фасетов; ноды дерева ссылаются на них по facetId */
  facets: FacetConfig[]
  sections: ClassifierSection[]
  readDirection: ReadDirection
  /** Порядок важен: первый — режим по умолчанию */
  inputModes: ClassifierInputMode[]
  shortNameRule?: ShortNameRule
  /** Разрешённые символы шифра (кроме разделителей). По ТЗ — буквенно-цифровой */
  allowedCharsPattern?: string
}

/** Краткая карточка для списка */
export interface ClassifierSummary {
  id: string
  name: string
  description?: string
  facetCount: number
  catalogCount: number
  /** Наименования справочников, к которым привязан классификатор */
  boundCatalogs: string[]
  /** Утверждённых записей */
  entryCount: number
}

/** Запись (классифицированная позиция), используется для проверки дубликатов */
export interface ClassifierEntry {
  id: string
  classifierId: string
  catalogId: string
  code: string
  decoded: string
  shortName: string
}
