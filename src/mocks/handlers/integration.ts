// Моки: интеграции — системы, потоки, запуск, журнал. Настройка и пакетные запуски — администратор;
// выгрузить один элемент может и тот, кто изменяет справочник (модератор).

import { http, HttpResponse } from 'msw'
import { endpoints, fullUrl } from '@/api/endpoints'
import type { PingResult } from '@/api/integration'
import type { ExchangeStatus, ExternalSystem, IntegrationFlow } from '@/types'
import { audit } from '../audit'
import { db } from '../db'
import { runFlow } from '../integration'
import { apiError, forbidden, latency, notFound, unauthorized, userCan, userFromRequest, userIsAdmin } from '../utils'

const STATUSES: readonly ExchangeStatus[] = ['success', 'error', 'skipped']

export const integrationHandlers = [
  http.get(fullUrl(endpoints.integrations.systems), ({ request }) => (userFromRequest(request) ? HttpResponse.json(db.systems) : unauthorized())),

  http.put<{ id: string }, ExternalSystem>(fullUrl(endpoints.integrations.system(':id')), async ({ request, params }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userIsAdmin(user)) return forbidden()
    const idx = db.systems.findIndex((s) => s.id === params.id)
    if (idx === -1) return notFound('Система')
    const sys = { ...(await request.json()), id: params.id }
    db.systems[idx] = sys
    audit(user, sys.enabled ? 'Обмен включён' : 'Обмен отключён', 'integration', sys.id, sys.name)
    return HttpResponse.json(sys)
  }),

  http.post<{ id: string }>(fullUrl(endpoints.integrations.ping(':id')), async ({ request, params }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()
    const sys = db.systems.find((s) => s.id === params.id)
    if (!sys) return notFound('Система')
    const res: PingResult = sys.enabled
      ? { ok: true, ms: 40 + ((sys.id.length * 37) % 160), message: `Связь установлена: ${sys.endpoint}` }
      : { ok: false, ms: 0, message: 'Обмен с системой отключён' }
    return HttpResponse.json(res)
  }),

  http.get(fullUrl(endpoints.integrations.flows), ({ request }) => (userFromRequest(request) ? HttpResponse.json(db.flows) : unauthorized())),

  http.put<{ id: string }, IntegrationFlow>(fullUrl(endpoints.integrations.flow(':id')), async ({ request, params }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userIsAdmin(user)) return forbidden()
    const flow = { ...(await request.json()), id: params.id }
    if (!db.systems.some((s) => s.id === flow.systemId)) return apiError(400, 'SYSTEM', 'Неизвестная система')
    if (!db.catalogs.some((c) => c.id === flow.catalogId)) return apiError(400, 'CATALOG', 'Неизвестный справочник')
    if (flow.mapping.some((m) => !m.target.trim() || !m.source)) return apiError(400, 'MAPPING', 'В сопоставлении есть пустые поля')
    const idx = db.flows.findIndex((f) => f.id === flow.id)
    if (idx === -1) db.flows.push(flow)
    else db.flows[idx] = flow
    audit(user, 'Изменён поток обмена', 'integration', flow.id, flow.name)
    return HttpResponse.json(flow)
  }),

  http.post<{ id: string }, { elementId?: string }>(fullUrl(endpoints.integrations.run(':id')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const flow = db.flows.find((f) => f.id === params.id)
    if (!flow) return notFound('Поток')
    const { elementId } = await request.json()
    const allowed = userIsAdmin(user) || (elementId !== undefined && userCan(user, 'catalog', flow.catalogId, 'update'))
    if (!allowed) return forbidden('Запускать обмен может администратор')
    if (!db.systems.find((s) => s.id === flow.systemId)?.enabled) return apiError(409, 'DISABLED', 'Обмен с системой отключён')
    const res = runFlow(flow, 'manual', elementId)
    audit(user, elementId ? 'Выгрузка элемента' : 'Запуск потока обмена', 'integration', flow.id, flow.name, res.summary)
    return HttpResponse.json(res)
  }),

  http.get(fullUrl(endpoints.integrations.journal), ({ request }) => {
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    const url = new URL(request.url)
    const systemId = url.searchParams.get('systemId')
    const statusParam = url.searchParams.get('status')
    const status = STATUSES.find((s) => s === statusParam) ?? null
    const elementId = url.searchParams.get('elementId')
    // Весь журнал — администратору; по своему элементу — любому, кто видит справочник
    if (!userIsAdmin(user) && !elementId) return forbidden()
    const rows = db.journal
      .filter((r) => (!systemId || r.systemId === systemId) && (!status || r.status === status) && (!elementId || r.elementId === elementId))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 500)
    return HttpResponse.json(rows)
  }),
]
