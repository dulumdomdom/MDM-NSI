// Интеграции MDM с внешними системами предприятия (АСУ, 1С, Imbase):
// поток обмена = система + справочник + направление + триггер + фильтры + сопоставление полей.
// Каждая передача фиксируется в журнале; у элемента хранятся его идентификаторы во внешних системах.

import type { IsoDateTime } from './common'

/** Протоколы из ТЗ */
export type IntegrationProtocol = 'rest' | 'soap' | '1c-bus' | 'com' | 'sql' | 'rabbitmq' | 'kafka' | 'xml' | 'csv'

export interface ExternalSystem {
  id: string
  name: string
  /** Роль системы на предприятии — подсказка администратору */
  role: string
  protocol: IntegrationProtocol
  /** Адрес подключения: URL, очередь, строка подключения, каталог обмена */
  endpoint: string
  enabled: boolean
  /** Как называется идентификатор записи в системе («Код номенклатуры 1С») */
  idLabel: string
}

export type FlowDirection = 'export' | 'import'

export type FlowSchedule = 'none' | 'hourly' | 'daily' | 'weekly'

export interface FlowTrigger {
  /** Экспорт: сразу при изменении элемента (утверждение заявки, правка, присвоение шифра) */
  onEvent: boolean
  schedule: FlowSchedule
}

/**
 * Сопоставление поля. source — откуда в MDM:
 *  id атрибута | 'code:<classifierId>' (шифр классификатора) | '$state' | '$id'.
 */
export interface FieldMapping {
  source: string
  /** Поле во внешней системе */
  target: string
  /** Без значения запись не передаётся (ошибка в журнале) */
  required?: boolean
}

export interface IntegrationFlow {
  id: string
  systemId: string
  catalogId: string
  name: string
  direction: FlowDirection
  trigger: FlowTrigger
  /** Экспорт: только элементы в этих состояниях (пусто — любые) */
  states: string[]
  /** Экспорт: только элементы с утверждёнными шифрами этих классификаторов */
  requireCodes: string[]
  mapping: FieldMapping[]
  /** Импорт: входящая позиция — заявкой на пополнение (через модераторов) или сразу в справочник */
  importMode: 'request' | 'direct'
  enabled: boolean
  lastRunAt?: IsoDateTime
}

export type ExchangeStatus = 'success' | 'error' | 'skipped'
export type ExchangeTrigger = 'event' | 'schedule' | 'manual'

/** Запись журнала обмена */
export interface ExchangeRecord {
  id: string
  flowId: string
  systemId: string
  catalogId: string
  direction: FlowDirection
  trigger: ExchangeTrigger
  at: IsoDateTime
  status: ExchangeStatus
  /** Элемент (для поштучной передачи) */
  elementId?: string
  elementName?: string
  externalId?: string
  /** Для пакетного запуска: сколько записей передано */
  count?: number
  message: string
}

/** Идентификатор элемента во внешней системе и состояние его синхронизации */
export interface ExternalRef {
  systemId: string
  externalId?: string
  status: 'synced' | 'error'
  syncedAt: IsoDateTime
  message?: string
}

/** Результат запуска потока */
export interface FlowRunResult {
  flow: IntegrationFlow
  records: ExchangeRecord[]
  /** Сводка для уведомления */
  summary: string
}
