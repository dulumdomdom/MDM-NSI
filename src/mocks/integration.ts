// «Сервер» интеграций: выгрузка элементов по потокам (по событию, по расписанию, вручную),
// импорт из внешних систем (заявкой на пополнение или сразу), журнал обмена.
// Реальный бэкенд вызывает адаптеры протоколов (1С:Шина, RabbitMQ, SQL Imbase); здесь — имитация.

import { textOf } from '@/lib/attributes'
import { buildPayload, checkExport, externalIdFor } from '@/lib/integration'
import type { CatalogElement, ExchangeRecord, ExchangeTrigger, ExternalRef, FlowRunResult, IntegrationFlow } from '@/types'
import { db, nextId, nowIso } from './db'
import { openRequest } from './workflow'

const SYSTEM_USER: Record<string, string> = { imbase: 'u-int-imbase', '1c': 'u-int-1c' }

function log(rec: Omit<ExchangeRecord, 'id' | 'at'>): ExchangeRecord {
  const r: ExchangeRecord = { ...rec, id: nextId('ex'), at: nowIso() }
  db.journal.push(r)
  return r
}

function setRef(el: CatalogElement, ref: ExternalRef): void {
  el.externalRefs = [...(el.externalRefs ?? []).filter((r) => r.systemId !== ref.systemId), ref]
}

const nameOf = (el: CatalogElement): string => {
  const catalog = db.catalogs.find((c) => c.id === el.catalogId)
  return textOf(el.attributes[catalog?.displayAttributeId ?? 'name'], el.id)
}

/** Выгрузить один элемент по потоку. null — элемент не подходит под фильтры потока */
export function exportElement(flow: IntegrationFlow, el: CatalogElement, trigger: ExchangeTrigger): ExchangeRecord | null {
  const system = db.systems.find((s) => s.id === flow.systemId)
  const catalog = db.catalogs.find((c) => c.id === flow.catalogId)
  if (!system?.enabled || !flow.enabled || !catalog || flow.direction !== 'export') return null
  if (!checkExport(flow, el).eligible) return null

  const base = { flowId: flow.id, systemId: system.id, catalogId: catalog.id, direction: 'export' as const, trigger, elementId: el.id, elementName: nameOf(el) }
  const payload = buildPayload(flow.mapping, el, catalog)
  if (payload.missing.length) {
    const message = `Не заполнено: ${payload.missing.join(', ')}`
    setRef(el, { systemId: system.id, status: 'error', syncedAt: nowIso(), message })
    return log({ ...base, status: 'error', message })
  }
  const externalId = el.externalRefs?.find((r) => r.systemId === system.id)?.externalId ?? externalIdFor(system.id, el.id)
  setRef(el, { systemId: system.id, externalId, status: 'synced', syncedAt: nowIso() })
  return log({ ...base, status: 'success', externalId, message: `Передано полей: ${Object.keys(payload.fields).length}` })
}

/** Элемент изменился (утверждена заявка, правка, шифр) — выгрузка по потоками «при изменении» */
export function onElementChanged(el: CatalogElement): ExchangeRecord[] {
  return db.flows
    .filter((f) => f.catalogId === el.catalogId && f.direction === 'export' && f.trigger.onEvent)
    .flatMap((f) => exportElement(f, el, 'event') ?? [])
}

/** Импорт: позиции из внешней системы — заявкой на пополнение или сразу в справочник */
function runImport(flow: IntegrationFlow, trigger: ExchangeTrigger): ExchangeRecord[] {
  const system = db.systems.find((s) => s.id === flow.systemId)
  const catalog = db.catalogs.find((c) => c.id === flow.catalogId)
  if (!system || !catalog) return []
  const author = db.users.find((u) => u.id === SYSTEM_USER[system.id])
  const records: ExchangeRecord[] = []
  const base = { flowId: flow.id, systemId: system.id, catalogId: catalog.id, direction: 'import' as const, trigger }

  for (const item of db.incoming[flow.id] ?? []) {
    const name = textOf(item.attributes[catalog.displayAttributeId], item.externalId)
    // Уже есть: элемент с этим внешним id или незакрытая заявка из этой же записи
    const known =
      db.elements.some((e) => e.externalRefs?.some((r) => r.systemId === system.id && r.externalId === item.externalId)) ||
      db.requests.some((r) => r.status === 'in_review' && r.payload.source?.externalId === item.externalId)
    if (known) continue

    if (flow.importMode === 'request' && author) {
      const req = openRequest(
        {
          title: `Пополнение из ${system.name}: ${name}`,
          targetType: 'catalog-element',
          targetId: catalog.id,
          payload: { name, attributes: item.attributes, query: `${system.name}: ${item.externalId}`, source: { systemId: system.id, externalId: item.externalId }, ...(item.parentId ? { parentId: item.parentId } : {}) },
        },
        author,
      )
      records.push(log({ ...base, status: 'success', elementName: name, externalId: item.externalId, message: req ? `Создана заявка ${req.id} — ждёт модераторов` : 'Добавлено без согласования' }))
    } else {
      const state = catalog.states.find((s) => s.id === 'active')?.id ?? catalog.states[0]?.id ?? 'draft'
      const el: CatalogElement = {
        id: nextId('el'),
        catalogId: catalog.id,
        attributes: item.attributes,
        state,
        ...(item.parentId ? { parentId: item.parentId } : {}),
        history: [{ type: 'version', id: nextId('h'), at: nowIso(), userId: author?.id ?? 'system', version: 1, snapshot: item.attributes }],
        externalRefs: [{ systemId: system.id, externalId: item.externalId, status: 'synced', syncedAt: nowIso() }],
      }
      db.elements.push(el)
      records.push(log({ ...base, status: 'success', elementId: el.id, elementName: name, externalId: item.externalId, message: 'Добавлено в справочник' }))
    }
  }
  if (records.length === 0) records.push(log({ ...base, status: 'success', count: 0, message: 'Новых записей нет' }))
  return records
}

/** Запуск потока: пакетная выгрузка (или одного элемента) либо импорт */
export function runFlow(flow: IntegrationFlow, trigger: ExchangeTrigger, elementId?: string): FlowRunResult {
  flow.lastRunAt = nowIso()
  if (flow.direction === 'import') {
    const records = runImport(flow, trigger)
    const added = records.filter((r) => r.externalId).length
    return { flow, records, summary: added ? `Получено записей: ${added}` : 'Новых записей нет' }
  }
  const elements = db.elements.filter((e) => e.catalogId === flow.catalogId && (!elementId || e.id === elementId))
  const results = elements.map((el) => exportElement(flow, el, trigger)).filter((r): r is ExchangeRecord => r !== null)
  const ok = results.filter((r) => r.status === 'success').length
  const failed = results.length - ok
  if (elementId) return { flow, records: results, summary: results[0]?.message ?? 'Элемент не подходит под условия потока' }
  // Пакет: в журнале остаются ошибки поштучно и одна сводная запись (успешные поштучные убираем)
  db.journal = db.journal.filter((r) => !(results.includes(r) && r.status === 'success'))
  const summary = log({
    flowId: flow.id,
    systemId: flow.systemId,
    catalogId: flow.catalogId,
    direction: 'export',
    trigger,
    status: failed ? 'error' : 'success',
    count: ok,
    message: `Пакетная выгрузка: передано ${ok}${failed ? `, ошибок ${failed}` : ''}`,
  })
  return { flow, records: [summary, ...results.filter((r) => r.status === 'error')], summary: summary.message }
}

const PERIOD_MS: Record<IntegrationFlow['trigger']['schedule'], number> = { none: Infinity, hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 }

/** Таймер: запустить потоки, у которых подошёл срок по расписанию */
export function runDueFlows(now = Date.now()): FlowRunResult[] {
  return db.flows
    .filter((f) => f.enabled && db.systems.find((s) => s.id === f.systemId)?.enabled)
    .filter((f) => now - (f.lastRunAt ? Date.parse(f.lastRunAt) : 0) >= PERIOD_MS[f.trigger.schedule])
    .map((f) => runFlow(f, 'schedule'))
}
