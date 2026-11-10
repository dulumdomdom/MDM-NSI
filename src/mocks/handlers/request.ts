// Моки: заявки (обходные листы), шаблоны согласования, уведомления.
// Видимость: администратор — все заявки; остальные — свои и те, где отвечают за строку.
// Строка шифрования закрывается подобранным шифром (сервер перепроверяет его и ищет дубликаты)
// или «не применимо», если шифр необязателен. Заявка обработана, когда пройдены все строки.

import { http, HttpResponse } from 'msw'
import { endpoints, fullUrl } from '@/api/endpoints'
import { parseCode } from '@/lib/classifier'
import { canDecideStep, canSeeRequest, onBehalfOf, requestScope } from '@/lib/rbac'
import type { CreateRequestDto, CreateRequestResult, DecideStepDto, Request, User, WorkflowConfig } from '@/types'
import { db, nowIso } from '../db'
import { audit } from '../audit'
import { acting, apiError, forbidden, latency, notFound, unauthorized, userCan, userCanGlobally, userFromRequest } from '../utils'
import { applyEdit, applyOutcome, createElementFromPayload, findCodeConflict, notifyResponsible, openRequest } from '../workflow'

/** Видимость: аудитор и руководитель НСИ (право на журнал) — все; остальные — свои, свои строки и строки замещаемых */
const sees = (user: User, r: Request): boolean => userCanGlobally(user, 'audit', 'read') || canSeeRequest(acting(user).assignments, user.id, r)

const DECISION: Record<DecideStepDto['decision'], string> = { approved: 'согласована', rejected: 'отклонена', skipped: 'отмечена «не применимо»' }

export const requestHandlers = [
  http.get(fullUrl(endpoints.requests.list), async ({ request }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const visible = db.requests.filter((r) => sees(user, r))
    return HttpResponse.json(visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }),

  http.get<{ id: string }>(fullUrl(endpoints.requests.one(':id')), ({ request, params }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const r = db.requests.find((x) => x.id === params.id)
    if (!r) return notFound('Заявка')
    return sees(user, r) ? HttpResponse.json(r) : forbidden()
  }),

  http.post<never, CreateRequestDto>(fullUrl(endpoints.requests.list), async ({ request }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const dto = await request.json()
    const scope = requestScope(dto)
    const resource = scope.type === 'classifier' ? 'classifier' : 'catalog'
    if (!userCan(user, resource, dto.targetId, 'read') || !userCan(user, 'request', '*', 'create')) return forbidden('Нет доступа к объекту заявки')

    const req = openRequest(dto, user)
    audit(user, req ? 'Создана заявка' : 'Изменения внесены без согласования', 'request', req?.id, dto.title)
    let result: CreateRequestResult = { request: req, applied: false }
    // Лист пуст — изменения применяются сразу (например, корректировка без перешифровки)
    if (!req) {
      if (dto.targetType === 'catalog-element') {
        const el = createElementFromPayload({ ...dto, id: '' }, user.id)
        result = { request: null, applied: true, ...(el ? { elementId: el.id } : {}) }
      } else if (dto.targetType === 'element-edit') {
        const el = applyEdit({ ...dto, id: '' }, user.id)
        if (!el) return notFound('Элемент')
        result = { request: null, applied: true, elementId: el.id }
      } else {
        return apiError(400, 'NO_WORKFLOW', 'Для объекта не настроен обходной лист')
      }
    }
    return HttpResponse.json(result, { status: 201 })
  }),

  http.post<{ id: string; stepId: string }, DecideStepDto>(fullUrl(endpoints.requests.decide(':id', ':stepId')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const req = db.requests.find((r) => r.id === params.id)
    if (!req) return notFound('Заявка')
    const step = req.steps.find((s) => s.id === params.stepId)
    if (!step) return notFound('Строка обходного листа')
    const act = acting(user)
    if (!canDecideStep(act.assignments, req, step)) return forbidden('За эту строку отвечает другой модератор или сейчас не её очередь')
    const behalf = onBehalfOf(user.assignments, act.delegations, req, step)
    const dto = await request.json()

    if (dto.decision === 'rejected' && !dto.comment?.trim()) return apiError(400, 'COMMENT_REQUIRED', 'Укажите причину отклонения')
    if (dto.decision === 'skipped' && !(step.kind === 'encode' && step.optional)) return apiError(400, 'NOT_OPTIONAL', 'Эту строку пропустить нельзя')

    // Строка шифрования: нужен корректный и уникальный шифр своего классификатора
    if (step.kind === 'encode' && dto.decision === 'approved') {
      const code = dto.code
      if (!code || code.classifierId !== step.classifierId) return apiError(400, 'CODE_REQUIRED', 'Подберите шифр классификатора строки')
      const classifier = db.classifiers.find((c) => c.id === code.classifierId)
      if (!classifier) return notFound('Классификатор')
      const parsed = parseCode(classifier, code.catalogId, code.code)
      if (!parsed.valid) return apiError(400, 'INVALID_CODE', parsed.issues.map((i) => i.message).join('; '))
      const conflict = findCodeConflict(code.classifierId, code.catalogId, code.code, req.payload.elementId, req.id)
      if (conflict.duplicate) {
        const where = conflict.source === 'element' ? `присвоен элементу «${conflict.element?.display ?? ''}»` : conflict.source === 'request' ? `уже в заявке ${conflict.requestId ?? ''}` : 'уже есть в классификаторе'
        return apiError(409, 'DUPLICATE', `Шифр ${where}`)
      }
      step.result = code
    }

    Object.assign(step, {
      status: dto.decision,
      decidedBy: user.id,
      decidedAt: nowIso(),
      ...(dto.comment ? { comment: dto.comment } : {}),
      ...(behalf ? { onBehalfOf: behalf } : {}),
    })
    const behalfName = behalf ? db.users.find((u) => u.id === behalf)?.fullName : undefined
    audit(user, `Строка «${step.name}» ${DECISION[dto.decision]}`, 'request', req.id, req.title, behalfName ? `за ${behalfName}` : dto.comment)

    if (dto.decision === 'rejected') {
      req.status = 'rejected'
      req.steps.filter((s) => s.status === 'pending').forEach((s) => (s.status = 'skipped'))
    } else if (req.steps.every((s) => s.status === 'approved' || s.status === 'skipped')) {
      req.status = 'approved'
    } else if (req.sequential) {
      // Последовательный лист: следующая строка становится активной — уведомляем её ответственных
      const next = req.steps.find((s) => s.status === 'pending')
      if (next) notifyResponsible(req, [next])
    }
    if (req.status !== 'in_review') {
      req.closedAt = nowIso()
      applyOutcome(req)
    }
    return HttpResponse.json(req)
  }),

  /* ------------------------- шаблоны согласования ------------------------- */

  http.get(fullUrl(endpoints.requests.workflows), ({ request }) => (userFromRequest(request) ? HttpResponse.json(db.workflows) : unauthorized())),

  http.put<{ id: string }, WorkflowConfig>(fullUrl(endpoints.requests.workflow(':id')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const wf = { ...(await request.json()), id: params.id }
    // Настраивать согласование может тот, кто настраивает сам объект (для '*' — глобально)
    const scope = requestScope(wf)
    const resource = scope.type === 'classifier' ? 'classifier' : 'catalog'
    if (!userCan(user, resource, wf.targetId, 'configure')) return forbidden('Нет права настраивать согласование')
    if (wf.steps.some((s) => !db.roles.some((r) => r.id === s.roleId))) return apiError(400, 'ROLE', 'В строке указана несуществующая роль')
    if (wf.steps.some((s) => s.kind === 'encode' && !db.classifiers.some((c) => c.id === s.classifierId)))
      return apiError(400, 'CLASSIFIER', 'В строке шифрования не выбран классификатор')
    const idx = db.workflows.findIndex((w) => w.id === wf.id)
    if (idx === -1) db.workflows.push(wf)
    else db.workflows[idx] = wf
    return HttpResponse.json(wf)
  }),

  http.delete<{ id: string }>(fullUrl(endpoints.requests.workflow(':id')), ({ request, params }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const wf = db.workflows.find((w) => w.id === params.id)
    if (!wf) return notFound('Шаблон')
    const scope = requestScope(wf)
    if (!userCan(user, scope.type === 'classifier' ? 'classifier' : 'catalog', wf.targetId, 'configure')) return forbidden()
    db.workflows = db.workflows.filter((w) => w.id !== params.id)
    return new HttpResponse(null, { status: 204 })
  }),

  /* ------------------------------ уведомления ------------------------------ */

  http.get(fullUrl(endpoints.notifications.list), ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    return HttpResponse.json(db.notifications.filter((n) => n.userId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  }),

  http.post<never, { ids?: string[] }>(fullUrl(endpoints.notifications.read), async ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const { ids } = await request.json()
    for (const n of db.notifications) if (n.userId === user.id && (!ids || ids.includes(n.id))) n.read = true
    return new HttpResponse(null, { status: 204 })
  }),
]
