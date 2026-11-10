// Логика «сервера» для обходных листов, уведомлений и реестра шифров — общая для обработчиков
// справочников, классификаторов и заявок.
//
// Отложенное применение: пополнение и корректировка попадают в справочник только после того, как
// пройдены все строки листа. Если для объекта лист пуст — изменения применяются сразу.

import type { DuplicateCheckResult } from '@/api/classifier'
import { normalizeCode } from '@/lib/classifier'
import { textOf } from '@/lib/attributes'
import { responsibleUsers } from '@/lib/rbac'
import { groupChain, stepApplies } from '@/lib/routing'
import type {
  CatalogElement,
  CreateRequestDto,
  EditHistory,
  ElementCode,
  Request,
  RequestStep,
  StepCode,
  User,
  WorkflowConfig,
} from '@/types'
import { db, nextId, nowIso } from './db'
import { onElementChanged } from './integration'

/* ------------------------------- шаблоны ------------------------------- */

/** Шаблон для объекта: сначала конкретный, затем общий '*' */
export function findWorkflow(targetType: Request['targetType'], targetId: string): WorkflowConfig | undefined {
  return (
    db.workflows.find((w) => w.targetType === targetType && w.targetId === targetId) ??
    db.workflows.find((w) => w.targetType === targetType && w.targetId === '*')
  )
}

type StepTemplate = WorkflowConfig['steps'][number]

/**
 * Строки листа для заявки. Корректировка с перешифровкой берёт строки шифрования из шаблона пополнения
 * этого справочника (а если там нет строки для классификатора — создаёт её для модератора классификатора).
 */
/** Группа позиции и её родители: для пополнения — из заявки, для корректировки — у элемента */
function chainOf(dto: CreateRequestDto): Set<string> {
  const start = dto.targetType === 'element-edit' ? db.elements.find((e) => e.id === dto.payload.elementId)?.parentId : dto.payload.parentId
  return groupChain(start, db.elements)
}

function stepsFor(dto: CreateRequestDto): { steps: StepTemplate[]; sequential: boolean } {
  const chain = chainOf(dto)
  const raw = rawStepsFor(dto)
  return { ...raw, steps: raw.steps.filter((s) => stepApplies(s, chain)).map((s, i) => ({ ...s, order: i + 1 })) }
}

function rawStepsFor(dto: CreateRequestDto): { steps: StepTemplate[]; sequential: boolean } {
  if (dto.targetType === 'element-edit') {
    const recode = dto.payload.recode ?? []
    const own = findWorkflow('element-edit', dto.targetId)
    const base = findWorkflow('catalog-element', dto.targetId)
    const encode: StepTemplate[] = recode.map(
      (classifierId, i) =>
        base?.steps.find((s) => s.kind === 'encode' && s.classifierId === classifierId) ?? {
          id: `st-enc-${classifierId}`,
          order: i + 1,
          kind: 'encode',
          name: `Перешифровка по классификатору ${db.classifiers.find((c) => c.id === classifierId)?.name ?? classifierId}`,
          roleId: 'role-moderator',
          classifierId,
          attributeIds: [],
        },
    )
    // Перешифровка обязательна — пропустить строку нельзя
    const steps = [...encode.map((s) => ({ ...s, optional: false })), ...(own?.steps ?? [])]
    return { steps: steps.map((s, i) => ({ ...s, order: i + 1 })), sequential: own?.sequential ?? false }
  }
  const wf = findWorkflow(dto.targetType, dto.targetId)
  return { steps: wf ? [...wf.steps].sort((a, b) => a.order - b.order) : [], sequential: wf?.sequential ?? false }
}

/* ------------------------------ уведомления ------------------------------ */

export function notify(userId: string, title: string, text: string, requestId?: string): void {
  db.notifications.push({ id: nextId('nt'), userId, title, text, ...(requestId ? { requestId } : {}), createdAt: nowIso(), read: false })
}

/** Строки, которые сейчас можно брать в работу (для последовательного листа — только первая) */
const activeSteps = (r: Request): RequestStep[] => {
  const pending = r.steps.filter((s) => s.status === 'pending')
  return r.sequential ? pending.slice(0, 1) : pending
}

/** Уведомить ответственных за активные строки (администраторы и так видят все заявки) */
export function notifyResponsible(r: Request, steps: RequestStep[] = activeSteps(r)): void {
  const label = r.payload.name ?? r.title
  for (const step of steps) {
    for (const to of responsibleUsers(db.users, r, step)) {
      // Ответственный в отпуске — уведомление получает заместитель, с пометкой «за кого»
      const instead = to.deputyFor ? db.users.find((u) => u.id === to.deputyFor)?.fullName : undefined
      notify(to.userId, instead ? `Новая заявка (замещение: ${instead})` : 'Новая заявка', `${label} — ${step.name.toLowerCase()}`, r.id)
    }
  }
}

/** Срок строки: создание заявки + нормативные часы */
const dueAt = (createdAt: string, hours?: number): string | undefined =>
  hours ? new Date(Date.parse(createdAt) + hours * 3_600_000).toISOString() : undefined

/* ------------------------------- заявки ------------------------------- */

/** Открыть заявку по шаблону. Пустой лист — null (изменения можно применить сразу) */
export function openRequest(dto: CreateRequestDto, author: User): Request | null {
  const { steps, sequential } = stepsFor(dto)
  if (steps.length === 0) return null
  const req: Request = {
    ...dto,
    id: nextId('req'),
    status: 'in_review',
    sequential,
    steps: [],
    createdBy: author.id,
    createdAt: nowIso(),
  }
  req.steps = steps.map((s) => {
    const due = dueAt(req.createdAt, s.dueHours)
    return { ...s, status: 'pending', ...(due ? { dueAt: due } : {}) }
  })
  db.requests.push(req)
  notifyResponsible(req)
  return req
}

/** Утверждённые шифры из строк шифрования */
const stepCodes = (r: Request): StepCode[] => r.steps.flatMap((s) => (s.kind === 'encode' && s.status === 'approved' && s.result ? [s.result] : []))

const toElementCode = (c: StepCode, userId: string, requestId?: string): ElementCode => ({
  ...c,
  status: 'approved',
  assignedBy: userId,
  assignedAt: nowIso(),
  ...(requestId ? { requestId } : {}),
})

/** Пополнение: новый элемент в справочник */
export function createElementFromPayload(r: Pick<Request, 'targetId' | 'payload' | 'id'>, userId: string, codes: StepCode[] = []): CatalogElement | null {
  const catalog = db.catalogs.find((c) => c.id === r.targetId)
  if (!catalog) return null
  const attributes = r.payload.attributes ?? {}
  const state = catalog.states.some((s) => s.id === 'active') ? 'active' : (catalog.states.find((s) => s.initial)?.id ?? 'draft')
  const el: CatalogElement = {
    id: nextId('el'),
    catalogId: catalog.id,
    attributes,
    state,
    ...(r.payload.parentId ? { parentId: r.payload.parentId } : {}),
    history: [{ type: 'version', id: nextId('h'), at: nowIso(), userId, version: 1, snapshot: attributes }],
    codes: codes.map((c) => toElementCode(c, userId, r.id)),
    // Позиция из внешней системы сразу связана со своей записью там
    ...(r.payload.source ? { externalRefs: [{ systemId: r.payload.source.systemId, externalId: r.payload.source.externalId, status: 'synced' as const, syncedAt: nowIso() }] } : {}),
  }
  db.elements.push(el)
  onElementChanged(el)
  return el
}

/** Корректировка: изменённые атрибуты (с историей) и новые шифры */
export function applyEdit(r: Pick<Request, 'payload' | 'id'>, userId: string, codes: StepCode[] = []): CatalogElement | null {
  const el = db.elements.find((e) => e.id === r.payload.elementId)
  if (!el) return null
  const at = nowIso()
  const changes: EditHistory[] = Object.entries(r.payload.attributes ?? {})
    .filter(([k, v]) => JSON.stringify(el.attributes[k] ?? null) !== JSON.stringify(v ?? null))
    .map(([attributeId, newValue]) => ({ type: 'attribute', id: nextId('h'), at, userId, attributeId, oldValue: el.attributes[attributeId] ?? null, newValue }))
  el.attributes = { ...el.attributes, ...(r.payload.attributes ?? {}) }
  if (codes.length) {
    const ids = new Set(codes.map((c) => c.classifierId))
    el.codes = [...(el.codes ?? []).filter((c) => !ids.has(c.classifierId)), ...codes.map((c) => toElementCode(c, userId, r.id))]
  }
  if (changes.length || codes.length) {
    const version = el.history.filter((h) => h.type === 'version').length + 1
    el.history = [...el.history, ...changes, { type: 'version', id: nextId('h'), at, userId, version, snapshot: el.attributes }]
    onElementChanged(el)
  }
  return el
}

/** Последствия закрытия заявки для объекта и уведомление автору */
export function applyOutcome(req: Request): void {
  const approved = req.status === 'approved'
  const p = req.payload
  const label = p.name ?? req.title

  if (approved) {
    if (req.targetType === 'catalog-element') createElementFromPayload(req, req.createdBy, stepCodes(req))
    if (req.targetType === 'element-edit') applyEdit(req, req.createdBy, stepCodes(req))
    if (req.targetType === 'classifier-entry' && p.code && p.catalogId) {
      db.entries.push({ id: nextId('e'), classifierId: req.targetId, catalogId: p.catalogId, code: p.code, decoded: p.decoded ?? '', shortName: p.shortName ?? '' })
    }
  }
  if (req.targetType === 'element-code') {
    const el = db.elements.find((e) => e.id === p.elementId)
    const code = el?.codes?.find((c) => c.classifierId === p.classifierId && c.requestId === req.id)
    if (code) code.status = approved ? 'approved' : 'rejected'
    if (el && approved) onElementChanged(el)
  }
  notify(
    req.createdBy,
    approved ? 'Заявка обработана' : 'Заявка отклонена',
    approved ? `${label} — изменения внесены в справочник` : `${label} — ${req.steps.find((s) => s.status === 'rejected')?.comment ?? 'отклонена'}`,
    req.id,
  )
}

/* ------------------------------ реестр шифров ------------------------------ */

/**
 * Поиск дубликата шифра по всему реестру: записи классификатора, заявки на согласовании
 * (в т.ч. шифры, уже подобранные в строках), шифры элементов справочников (кроме отклонённых).
 */
export function findCodeConflict(classifierId: string, catalogId: string, code: string, excludeElementId?: string, excludeRequestId?: string): DuplicateCheckResult {
  const key = normalizeCode(code)
  const entry = db.entries.find((e) => e.classifierId === classifierId && e.catalogId === catalogId && normalizeCode(e.code) === key)
  if (entry) return { duplicate: true, source: 'entry', entry }

  const pending = db.requests.find(
    (r) =>
      r.id !== excludeRequestId &&
      r.status === 'in_review' &&
      ((r.targetType === 'classifier-entry' && r.targetId === classifierId && r.payload.catalogId === catalogId && normalizeCode(r.payload.code ?? '') === key) ||
        r.steps.some((s) => s.result?.classifierId === classifierId && s.result.catalogId === catalogId && normalizeCode(s.result.code) === key)),
  )
  if (pending) return { duplicate: true, source: 'request', requestId: pending.id }

  for (const el of db.elements) {
    if (el.id === excludeElementId) continue
    const hit = el.codes?.find((c) => c.classifierId === classifierId && c.catalogId === catalogId && c.status !== 'rejected' && normalizeCode(c.code) === key)
    if (hit) {
      const catalog = db.catalogs.find((c) => c.id === el.catalogId)
      const display = textOf(el.attributes[catalog?.displayAttributeId ?? 'name'], el.id)
      return { duplicate: true, source: 'element', element: { catalogId: el.catalogId, elementId: el.id, display } }
    }
  }
  return { duplicate: false }
}
