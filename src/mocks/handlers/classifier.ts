// Моки: классификаторы (CRUD конфигурации), утверждённые записи, проверка дубликатов по всему реестру шифров.

import { http, HttpResponse } from 'msw'
import { endpoints, fullUrl } from '@/api/endpoints'
import { getCatalogs, validateClassifier } from '@/lib/classifier'
import type { Classifier, ClassifierSummary } from '@/types'
import { audit } from '../audit'
import { db } from '../db'
import { apiError, forbidden, latency, notFound, unauthorized, userCan, userCanGlobally, userFromRequest } from '../utils'
import { findCodeConflict } from '../workflow'

const configError = (c: Classifier) => {
  const issues = validateClassifier(c)
  return issues.length ? apiError(400, 'CONFIG', issues.map((i) => `${i.where}: ${i.message}`).join('; ')) : null
}

export const classifierHandlers = [
  http.get(fullUrl(endpoints.classifiers.list), async ({ request }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()
    const list: ClassifierSummary[] = db.classifiers.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      facetCount: c.facets.length,
      catalogCount: getCatalogs(c).length,
      boundCatalogs: db.catalogs.filter((cat) => cat.classifierBindings.some((b) => b.classifierId === c.id)).map((cat) => cat.name),
      entryCount: db.entries.filter((e) => e.classifierId === c.id).length,
    }))
    return HttpResponse.json(list)
  }),

  http.get<{ id: string }>(fullUrl(endpoints.classifiers.one(':id')), async ({ request, params }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()
    const c = db.classifiers.find((x) => x.id === params.id)
    return c ? HttpResponse.json(c) : notFound('Классификатор')
  }),

  http.post<never, Classifier>(fullUrl(endpoints.classifiers.list), async ({ request }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCanGlobally(user, 'classifier', 'configure')) return forbidden('Создавать классификаторы может методолог или администратор')
    const c = await request.json()
    if (db.classifiers.some((x) => x.id === c.id)) return apiError(409, 'EXISTS', 'Классификатор с таким идентификатором уже есть')
    // Новый классификатор может быть пустым (без фасетов) — проверяем только базовое
    if (!c.name.trim()) return apiError(400, 'CONFIG', 'Не задано наименование')
    db.classifiers.push(c)
    audit(user, 'Создан классификатор', 'classifier', c.id, c.name)
    return HttpResponse.json(c, { status: 201 })
  }),

  http.put<{ id: string }, Classifier>(fullUrl(endpoints.classifiers.one(':id')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'classifier', params.id, 'configure')) return forbidden('Нет права настраивать этот классификатор')
    const idx = db.classifiers.findIndex((x) => x.id === params.id)
    if (idx === -1) return notFound('Классификатор')
    const body = { ...(await request.json()), id: params.id }
    const err = configError(body)
    if (err) return err
    db.classifiers[idx] = body
    audit(user, 'Изменена конфигурация классификатора', 'classifier', body.id, body.name)
    return HttpResponse.json(body)
  }),

  http.delete<{ id: string }>(fullUrl(endpoints.classifiers.one(':id')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'classifier', params.id, 'configure')) return forbidden()
    const boundTo = db.catalogs.filter((c) => c.classifierBindings.some((b) => b.classifierId === params.id))
    if (boundTo.length) return apiError(409, 'BOUND', `Классификатор привязан к справочникам: ${boundTo.map((c) => c.name).join(', ')}`)
    audit(user, 'Удалён классификатор', 'classifier', params.id, db.classifiers.find((c) => c.id === params.id)?.name)
    db.classifiers = db.classifiers.filter((c) => c.id !== params.id)
    db.entries = db.entries.filter((e) => e.classifierId !== params.id)
    db.workflows = db.workflows.filter((w) => !(w.targetType === 'classifier-entry' && w.targetId === params.id))
    return new HttpResponse(null, { status: 204 })
  }),

  http.get<{ id: string }>(fullUrl(endpoints.classifiers.entries(':id')), ({ request, params }) => {
    if (!userFromRequest(request)) return unauthorized()
    return HttpResponse.json(db.entries.filter((e) => e.classifierId === params.id))
  }),

  http.post<{ id: string }, { catalogId: string; code: string; excludeElementId?: string }>(
    fullUrl(endpoints.classifiers.duplicateCheck(':id')),
    async ({ request, params }) => {
      await latency()
      if (!userFromRequest(request)) return unauthorized()
      const { catalogId, code, excludeElementId } = await request.json()
      return HttpResponse.json(findCodeConflict(params.id, catalogId, code, excludeElementId))
    },
  ),
]
