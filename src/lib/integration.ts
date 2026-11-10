// Интеграции: какие элементы передаются по потоку и что именно уходит во внешнюю систему.
// Чистые функции — используются «сервером» (моки) и интерфейсом (предпросмотр, подписи).

import type { Catalog, CatalogElement, FieldMapping, FlowTrigger, IntegrationFlow } from '@/types'
import { formatAttribute } from './attributes'

/** Значение источника сопоставления у элемента ('' — пусто) */
export function mappingValue(el: CatalogElement, source: string, catalog: Catalog): string {
  if (source === '$id') return el.id
  if (source === '$state') return catalog.states.find((s) => s.id === el.state)?.name ?? el.state
  if (source.startsWith('code:')) {
    const code = el.codes?.find((c) => c.classifierId === source.slice(5) && c.status === 'approved')
    return code?.code ?? ''
  }
  const attr = catalog.attributes.find((a) => a.id === source)
  return attr ? formatAttribute(attr, el.attributes[source]) : ''
}

export interface ExportCheck {
  /** Подходит ли элемент под фильтры потока */
  eligible: boolean
  reason?: string
}

/** Фильтры потока: состояние элемента и обязательные утверждённые шифры */
export function checkExport(flow: IntegrationFlow, el: CatalogElement): ExportCheck {
  if (el.isGroup) return { eligible: false, reason: 'группа' }
  if (flow.states.length && !flow.states.includes(el.state)) return { eligible: false, reason: 'элемент в этом состоянии не выгружается' }
  const missing = flow.requireCodes.filter((id) => !el.codes?.some((c) => c.classifierId === id && c.status === 'approved'))
  if (missing.length) return { eligible: false, reason: 'нет утверждённого шифра' }
  return { eligible: true }
}

export interface ExportPayload {
  /** Поле внешней системы → значение */
  fields: Record<string, string>
  /** Незаполненные обязательные поля (по их подписи во внешней системе) */
  missing: string[]
}

export function buildPayload(mapping: readonly FieldMapping[], el: CatalogElement, catalog: Catalog): ExportPayload {
  const fields: Record<string, string> = {}
  const missing: string[] = []
  for (const m of mapping) {
    const v = mappingValue(el, m.source, catalog)
    fields[m.target] = v
    if (m.required && v === '') missing.push(m.target)
  }
  return { fields, missing }
}

/** Подпись источника сопоставления для интерфейса */
export function sourceLabel(source: string, catalog: Catalog | null, classifierName: (id: string) => string): string {
  if (source === '$id') return 'Идентификатор MDM'
  if (source === '$state') return 'Состояние'
  if (source.startsWith('code:')) return `Шифр: ${classifierName(source.slice(5))}`
  return catalog?.attributes.find((a) => a.id === source)?.name ?? source
}

const SCHEDULE: Record<FlowTrigger['schedule'], string> = { none: '', hourly: 'ежечасно', daily: 'ежедневно', weekly: 'еженедельно' }

/** «при изменении + ежедневно» */
export function describeTrigger(t: FlowTrigger): string {
  const parts = [t.onEvent ? 'при изменении' : '', SCHEDULE[t.schedule]].filter(Boolean)
  return parts.length ? parts.join(' + ') : 'вручную'
}

/** Детерминированный внешний идентификатор (в моках — формат как в реальной системе) */
export function externalIdFor(systemId: string, elementId: string): string {
  let h = 0
  for (const ch of elementId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const n = String(h % 100_000_000).padStart(8, '0')
  if (systemId === '1c') return `НФ-${n}`
  if (systemId === 'imbase') return `IMB.${n.slice(0, 4)}.${n.slice(4)}`
  return `${systemId.toUpperCase()}-${n}`
}
