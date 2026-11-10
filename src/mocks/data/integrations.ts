// Внешние системы предприятия, потоки обмена, журнал и «входящие» данные для имитации импорта.

import type { AttributeValue, ExchangeRecord, ExternalSystem, IntegrationFlow } from '@/types'

export const systems: ExternalSystem[] = [
  {
    id: 'asu',
    name: 'АСУ производства',
    role: 'Планирование и учёт производства: получает действующую номенклатуру и шифры инструмента',
    protocol: 'rabbitmq',
    endpoint: 'amqp://asu-mq.zavod.local:5672/mdm.nomenclature',
    enabled: true,
    idLabel: 'Код АСУ',
  },
  {
    id: '1c',
    name: '1С:ERP',
    role: 'Учёт, закупки и склад: получает утверждённую номенклатуру, ведёт контрагентов',
    protocol: '1c-bus',
    endpoint: 'http://1c-erp.zavod.local/erp/hs/mdm/v1',
    enabled: true,
    idLabel: 'Код номенклатуры 1С',
  },
  {
    id: 'imbase',
    name: 'Imbase',
    role: 'Справочник стандартных изделий и материалов для КД: источник новых стандартных изделий, получает шифры',
    protocol: 'sql',
    endpoint: 'mssql://imbase-db.zavod.local/IMBASE',
    enabled: true,
    idLabel: 'ID объекта Imbase',
  },
]

export const flows: IntegrationFlow[] = [
  {
    id: 'fl-1c-nomenclature',
    systemId: '1c',
    catalogId: 'cat-nomenclature',
    name: 'Номенклатура → 1С',
    direction: 'export',
    trigger: { onEvent: true, schedule: 'daily' },
    states: ['active'],
    requireCodes: [],
    mapping: [
      { source: '$id', target: 'ИдентификаторMDM', required: true },
      { source: 'name', target: 'Наименование', required: true },
      { source: 'article', target: 'Артикул', required: true },
      { source: 'unit', target: 'ЕдиницаИзмерения', required: true },
      { source: 'code:cls-tool', target: 'КодКлассификатораИнструмента' },
      { source: 'code:cls-material', target: 'КодМатериала' },
    ],
    importMode: 'direct',
    enabled: true,
    lastRunAt: '2026-11-04T03:00:00Z',
  },
  {
    id: 'fl-1c-counterparties',
    systemId: '1c',
    catalogId: 'cat-counterparties',
    name: 'Контрагенты ← 1С',
    direction: 'import',
    trigger: { onEvent: false, schedule: 'daily' },
    states: [],
    requireCodes: [],
    mapping: [
      { source: 'name', target: 'Наименование', required: true },
      { source: 'inn', target: 'ИНН', required: true },
    ],
    // 1С — мастер-система контрагентов: записи поступают сразу
    importMode: 'direct',
    enabled: true,
    lastRunAt: '2026-11-04T03:05:00Z',
  },
  {
    id: 'fl-imbase-standard',
    systemId: 'imbase',
    catalogId: 'cat-nomenclature',
    name: 'Стандартные изделия ← Imbase',
    direction: 'import',
    trigger: { onEvent: false, schedule: 'hourly' },
    states: [],
    requireCodes: [],
    mapping: [
      { source: 'name', target: 'Наименование', required: true },
      { source: 'article', target: 'Обозначение', required: true },
    ],
    // Новые изделия проходят модераторов, как пополнение от пользователя
    importMode: 'request',
    enabled: true,
    lastRunAt: '2026-11-04T08:00:00Z',
  },
  {
    id: 'fl-imbase-codes',
    systemId: 'imbase',
    catalogId: 'cat-nomenclature',
    name: 'Шифры → Imbase',
    direction: 'export',
    trigger: { onEvent: true, schedule: 'none' },
    states: ['active'],
    requireCodes: ['cls-tool'],
    mapping: [
      { source: 'article', target: 'Обозначение', required: true },
      { source: 'name', target: 'Наименование' },
      { source: 'code:cls-tool', target: 'КодКлассификатора', required: true },
    ],
    importMode: 'direct',
    enabled: true,
  },
  {
    id: 'fl-asu-nomenclature',
    systemId: 'asu',
    catalogId: 'cat-nomenclature',
    name: 'Номенклатура → АСУ',
    direction: 'export',
    trigger: { onEvent: true, schedule: 'hourly' },
    states: ['active'],
    requireCodes: [],
    mapping: [
      { source: '$id', target: 'mdmId', required: true },
      { source: 'name', target: 'name', required: true },
      { source: 'unit', target: 'uom', required: true },
      { source: 'code:cls-tool', target: 'toolCode' },
      { source: 'minBatch', target: 'minBatch' },
    ],
    importMode: 'direct',
    enabled: true,
    lastRunAt: '2026-11-04T08:00:00Z',
  },
]

export const journal: ExchangeRecord[] = [
  {
    id: 'ex-1',
    flowId: 'fl-1c-nomenclature',
    systemId: '1c',
    catalogId: 'cat-nomenclature',
    direction: 'export',
    trigger: 'schedule',
    at: '2026-11-04T03:00:00Z',
    status: 'success',
    count: 752,
    message: 'Пакетная выгрузка: передано 752 позиции',
  },
  {
    id: 'ex-2',
    flowId: 'fl-1c-counterparties',
    systemId: '1c',
    catalogId: 'cat-counterparties',
    direction: 'import',
    trigger: 'schedule',
    at: '2026-11-04T03:05:00Z',
    status: 'success',
    count: 0,
    message: 'Новых контрагентов нет',
  },
  {
    id: 'ex-3',
    flowId: 'fl-asu-nomenclature',
    systemId: 'asu',
    catalogId: 'cat-nomenclature',
    direction: 'export',
    trigger: 'event',
    at: '2026-11-04T07:41:00Z',
    status: 'error',
    elementId: 'n-g00004',
    elementName: 'Штангенциркуль ШЦ-I32 исп. 5',
    message: 'Очередь недоступна (таймаут 30 с), повтор при следующем запуске',
  },
  {
    id: 'ex-4',
    flowId: 'fl-imbase-standard',
    systemId: 'imbase',
    catalogId: 'cat-nomenclature',
    direction: 'import',
    trigger: 'schedule',
    at: '2026-11-04T08:00:00Z',
    status: 'success',
    count: 0,
    message: 'Новых стандартных изделий нет',
  },
]

/** Что «лежит» во внешних системах — имитация входящих данных для импорта */
export interface IncomingItem {
  externalId: string
  attributes: Record<string, AttributeValue>
  parentId?: string
}

const pcs = { catalogId: 'cat-units', elementId: 'u-pcs', display: 'шт' }

export const incoming: Record<string, IncomingItem[]> = {
  'fl-imbase-standard': [
    {
      externalId: 'IMB.0107.0332',
      parentId: 'g-fasteners',
      attributes: { name: 'Винт А.М6-6gx20.58.016 ГОСТ 17473-80', article: 'ГОСТ 17473-80 М6х20', unit: pcs, price: null, minBatch: 100, registeredAt: null, drawing: null },
    },
    {
      externalId: 'IMB.0107.0418',
      parentId: 'g-fasteners',
      attributes: { name: 'Шайба 6 65Г ГОСТ 6402-70', article: 'ГОСТ 6402-70 6', unit: pcs, price: null, minBatch: 200, registeredAt: null, drawing: null },
    },
  ],
  'fl-1c-counterparties': [
    {
      externalId: 'К-000318',
      attributes: {
        name: 'ООО «Уралпромснаб»',
        inn: '6670412345',
        address: { postcode: 620102, city: 'Екатеринбург', street: 'ул. Посадская', house: '16' },
        contractDate: null,
        contractScan: null,
      },
    },
  ],
}
