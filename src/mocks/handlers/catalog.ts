// Моки: справочники — структура (CRUD), элементы (CRUD, история, перенос, сверка), присвоение шифров.

import { http, HttpResponse } from 'msw'
import { endpoints, fullUrl } from '@/api/endpoints'
import type { AssignCodeDto, AssignCodeResult, ReconcileResult, SaveElementDto, SaveElementResult } from '@/api/catalog'
import { textOf } from '@/lib/attributes'
import { validateCatalog } from '@/lib/catalogSchema'
import { parseCode } from '@/lib/classifier'
import { similarity, normalizeText } from '@/lib/search'
import type { Catalog, CatalogElement, CatalogSummary, EditHistory, ElementCode } from '@/types'
import { db, nextId, nowIso } from '../db'
import { apiError, forbidden, latency, notFound, unauthorized, userCan, userCanGlobally, userFromRequest } from '../utils'
import { audit } from '../audit'
import { onElementChanged } from '../integration'
import { findCodeConflict, openRequest } from '../workflow'

type CatalogParams = { catalogId: string }
type ElementParams = { catalogId: string; elementId: string }

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Внешние базы НСИ из ТЗ (имитация ответа) */
const EXTERNAL_SOURCES = ['Техэксперт', 'Реестр ФНС', 'ФГИС «Аршин»', 'КЛАДР']

const schemaError = (c: Catalog) => {
  const issues = validateCatalog(
    c,
    db.catalogs.map((x) => x.id).concat(c.id),
    db.classifiers.map((x) => x.id),
  )
  return issues.length ? apiError(400, 'SCHEMA', issues.map((i) => `${i.where}: ${i.message}`).join('; ')) : null
}

const displayOf = (el: CatalogElement): string => {
  const catalog = db.catalogs.find((c) => c.id === el.catalogId)
  return textOf(el.attributes[catalog?.displayAttributeId ?? 'name'], el.id)
}

export const catalogHandlers = [
  /* ----------------------------- структура ----------------------------- */

  http.get(fullUrl(endpoints.catalogs.list), async ({ request }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()
    const list: CatalogSummary[] = db.catalogs.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      hierarchical: c.hierarchical,
      elementCount: db.elements.filter((e) => e.catalogId === c.id && !e.isGroup).length,
      attributeCount: c.attributes.length,
      classifierCount: c.classifierBindings.length,
    }))
    return HttpResponse.json(list)
  }),

  http.get<{ id: string }>(fullUrl(endpoints.catalogs.one(':id')), async ({ request, params }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()
    const c = db.catalogs.find((x) => x.id === params.id)
    return c ? HttpResponse.json(c) : notFound('Справочник')
  }),

  http.post<never, Catalog>(fullUrl(endpoints.catalogs.list), async ({ request }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCanGlobally(user, 'catalog', 'configure')) return forbidden('Создавать справочники может методолог или администратор')
    const c = await request.json()
    if (db.catalogs.some((x) => x.id === c.id)) return apiError(409, 'EXISTS', 'Справочник с таким идентификатором уже есть')
    const err = schemaError(c)
    if (err) return err
    db.catalogs.push(c)
    audit(user, 'Создан справочник', 'catalog', c.id, c.name)
    return HttpResponse.json(c, { status: 201 })
  }),

  http.put<{ id: string }, Catalog>(fullUrl(endpoints.catalogs.one(':id')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'catalog', params.id, 'configure')) return forbidden('Нет права настраивать этот справочник')
    const idx = db.catalogs.findIndex((x) => x.id === params.id)
    if (idx === -1) return notFound('Справочник')
    const c = { ...(await request.json()), id: params.id }
    const err = schemaError(c)
    if (err) return err
    db.catalogs[idx] = c
    audit(user, 'Изменена структура справочника', 'catalog', c.id, c.name)
    return HttpResponse.json(c)
  }),

  http.delete<{ id: string }>(fullUrl(endpoints.catalogs.one(':id')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'catalog', params.id, 'configure')) return forbidden()
    const referencedBy = db.catalogs.filter(
      (c) => c.id !== params.id && c.attributes.some((a) => a.type === 'reference' && a.referenceCatalogId === params.id),
    )
    if (referencedBy.length) return apiError(409, 'REFERENCED', `На справочник ссылаются: ${referencedBy.map((c) => c.name).join(', ')}`)
    audit(user, 'Удалён справочник', 'catalog', params.id, db.catalogs.find((c) => c.id === params.id)?.name)
    db.catalogs = db.catalogs.filter((c) => c.id !== params.id)
    db.elements = db.elements.filter((e) => e.catalogId !== params.id)
    db.workflows = db.workflows.filter((w) => !(w.targetId === params.id && w.targetType !== 'classifier-entry'))
    return new HttpResponse(null, { status: 204 })
  }),

  /* ------------------------------ элементы ------------------------------ */

  http.get<CatalogParams>(fullUrl(endpoints.catalogs.elements(':catalogId')), async ({ request, params }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()
    // Настоящий бэкенд обязан применять RBAC и здесь; клиентский фильтр — второй рубеж
    return HttpResponse.json(db.elements.filter((e) => e.catalogId === params.catalogId))
  }),

  http.post<CatalogParams, SaveElementDto>(fullUrl(endpoints.catalogs.elements(':catalogId')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'catalog', params.catalogId, 'create')) return forbidden()
    const dto = await request.json()
    const el: CatalogElement = {
      id: nextId('el'),
      catalogId: params.catalogId,
      attributes: dto.attributes,
      state: dto.state,
      ...(dto.parentId ? { parentId: dto.parentId } : {}),
      ...(dto.isGroup ? { isGroup: true } : {}),
      history: [{ type: 'version', id: nextId('h'), at: nowIso(), userId: user.id, version: 1, snapshot: dto.attributes }],
      codes: [],
    }
    db.elements.push(el)
    audit(user, dto.isGroup ? 'Создана группа' : 'Создан элемент', 'element', el.id, displayOf(el))
    onElementChanged(el)
    // Модератор вносит элемент сам; пополнение через обходной лист — путь пользователя (страница «Пополнение»)
    const result: SaveElementResult = { element: el }
    return HttpResponse.json(result, { status: 201 })
  }),

  http.put<ElementParams, SaveElementDto>(fullUrl(endpoints.catalogs.element(':catalogId', ':elementId')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'catalog', params.catalogId, 'update')) return forbidden()
    const el = db.elements.find((e) => e.id === params.elementId && e.catalogId === params.catalogId)
    if (!el) return notFound('Элемент')
    const dto = await request.json()
    const at = nowIso()
    // История трёх типов: по атрибутам, по состоянию и версия-снимок
    const changes: EditHistory[] = Object.entries(dto.attributes)
      .filter(([k, v]) => !sameValue(el.attributes[k], v))
      .map(([attributeId, newValue]) => ({
        type: 'attribute',
        id: nextId('h'),
        at,
        userId: user.id,
        attributeId,
        oldValue: el.attributes[attributeId] ?? null,
        newValue,
      }))
    if (dto.state !== el.state) changes.push({ type: 'state', id: nextId('h'), at, userId: user.id, fromState: el.state, toState: dto.state })
    if (changes.length > 0) {
      const version = el.history.filter((h) => h.type === 'version').length + 1
      changes.push({ type: 'version', id: nextId('h'), at, userId: user.id, version, snapshot: dto.attributes })
    }
    Object.assign(el, { attributes: dto.attributes, state: dto.state, history: [...el.history, ...changes] })
    if (changes.length) {
      const fields = changes.filter((c) => c.type !== 'version').length
      audit(user, 'Изменён элемент', 'element', el.id, displayOf(el), `изменений: ${fields}`)
      onElementChanged(el)
    }
    const result: SaveElementResult = { element: el }
    return HttpResponse.json(result)
  }),

  http.delete<ElementParams>(fullUrl(endpoints.catalogs.element(':catalogId', ':elementId')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'catalog', params.catalogId, 'delete')) return forbidden()
    if (db.elements.some((e) => e.parentId === params.elementId)) return apiError(409, 'HAS_CHILDREN', 'В группе есть элементы')
    const removed = db.elements.find((e) => e.id === params.elementId)
    db.elements = db.elements.filter((e) => e.id !== params.elementId)
    if (removed) audit(user, 'Удалён элемент', 'element', removed.id, displayOf(removed))
    return new HttpResponse(null, { status: 204 })
  }),

  http.post<ElementParams, { parentId: string | null }>(fullUrl(endpoints.catalogs.move(':catalogId', ':elementId')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'catalog', params.catalogId, 'update')) return forbidden()
    const { parentId } = await request.json()
    const el = db.elements.find((e) => e.id === params.elementId)
    if (!el) return notFound('Элемент')
    // Защита от циклов: нельзя перенести группу внутрь самой себя
    let cursor = parentId
    while (cursor) {
      if (cursor === el.id) return apiError(400, 'CYCLE', 'Нельзя перенести группу в собственную подгруппу')
      cursor = db.elements.find((e) => e.id === cursor)?.parentId ?? null
    }
    if (parentId) el.parentId = parentId
    else delete el.parentId
    return HttpResponse.json(el)
  }),

  http.post<ElementParams>(fullUrl(endpoints.catalogs.reconcile(':catalogId', ':elementId')), async ({ request, params }) => {
    await latency()
    if (!userFromRequest(request)) return unauthorized()
    const el = db.elements.find((e) => e.id === params.elementId)
    if (!el) return notFound('Элемент')
    const name = textOf(el.attributes['name'])
    // Имитация: «внешнее» имя — нормализованное своё; совпадение зависит от источника
    const results: ReconcileResult[] = EXTERNAL_SOURCES.map((source, i) => {
      const found = (name.length + i) % 3 !== 0
      const externalName = found ? normalizeText(name).toUpperCase() : undefined
      return { source, found, ...(externalName ? { externalName, similarity: Number(similarity(normalizeText(name), externalName.toLowerCase()).toFixed(2)) } : {}) }
    })
    return HttpResponse.json(results)
  }),

  /* --------------------------- шифры элементов --------------------------- */

  http.post<ElementParams, AssignCodeDto>(fullUrl(endpoints.catalogs.codes(':catalogId', ':elementId')), async ({ request, params }) => {
    await latency()
    const user = userFromRequest(request)
    if (!user) return unauthorized()
    if (!userCan(user, 'catalog', params.catalogId, 'update')) return forbidden('Нет права изменять элементы справочника')
    const catalog = db.catalogs.find((c) => c.id === params.catalogId)
    const el = db.elements.find((e) => e.id === params.elementId && e.catalogId === params.catalogId)
    if (!catalog || !el) return notFound('Элемент')
    const dto = await request.json()
    if (!catalog.classifierBindings.some((b) => b.classifierId === dto.classifierId))
      return apiError(400, 'NOT_BOUND', 'Классификатор не привязан к справочнику')

    // Сервер перепроверяет шифр тем же движком, что и клиент
    const classifier = db.classifiers.find((c) => c.id === dto.classifierId)
    if (!classifier) return notFound('Классификатор')
    const parsed = parseCode(classifier, dto.catalogId, dto.code)
    if (!parsed.valid) return apiError(400, 'INVALID_CODE', parsed.issues.map((i) => i.message).join('; '))

    const conflict = findCodeConflict(dto.classifierId, dto.catalogId, dto.code, el.id)
    if (conflict.duplicate) {
      const where =
        conflict.source === 'element'
          ? `присвоен элементу «${conflict.element?.display ?? ''}»`
          : conflict.source === 'request'
            ? 'уже на согласовании'
            : 'уже есть в классификаторе'
      return apiError(409, 'DUPLICATE', `Шифр ${where}`)
    }

    const req = openRequest(
      {
        title: `Шифр для «${displayOf(el)}»`,
        targetType: 'element-code',
        targetId: catalog.id,
        payload: { elementId: el.id, name: displayOf(el), ...dto },
      },
      user,
    )
    const code: ElementCode = {
      ...dto,
      status: req ? 'on_approval' : 'approved',
      ...(req ? { requestId: req.id } : {}),
      assignedBy: user.id,
      assignedAt: nowIso(),
    }
    // Не более одного шифра на классификатор: новый заменяет прежний
    el.codes = [...(el.codes ?? []).filter((c) => c.classifierId !== dto.classifierId), code]
    audit(user, code.status === 'approved' ? 'Присвоен шифр' : 'Шифр отправлен на согласование', 'element', el.id, displayOf(el), dto.code)
    if (code.status === 'approved') onElementChanged(el)
    const result: AssignCodeResult = { element: el, ...(req ? { requestId: req.id } : {}) }
    return HttpResponse.json(result)
  }),

  http.delete<ElementParams & { classifierId: string }>(
    fullUrl(endpoints.catalogs.code(':catalogId', ':elementId', ':classifierId')),
    async ({ request, params }) => {
      await latency()
      const user = userFromRequest(request)
      if (!user) return unauthorized()
      if (!userCan(user, 'catalog', params.catalogId, 'update')) return forbidden()
      const el = db.elements.find((e) => e.id === params.elementId)
      if (!el) return notFound('Элемент')
      el.codes = (el.codes ?? []).filter((c) => c.classifierId !== params.classifierId)
      audit(user, 'Снят шифр', 'element', el.id, displayOf(el), params.classifierId)
      return HttpResponse.json(el)
    },
  ),
]
