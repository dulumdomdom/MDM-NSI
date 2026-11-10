// Логика «сервера»: обходные листы с отложенным применением, уведомления, реестр шифров.

import { beforeEach, describe, expect, it } from 'vitest'
import { validateCatalog } from '@/lib/catalogSchema'
import { actingAssignments, canDecideStep, canSeeRequest, delegationsOf, isOverdue, onBehalfOf, responsibleUsers } from '@/lib/rbac'
import type { Request } from '@/types'
import { catalogs } from '../data/catalogs'
import { db, resetDb } from '../db'
import { applyOutcome, findCodeConflict, findWorkflow, openRequest } from '../workflow'

const user = (id: string) => {
  const u = db.users.find((x) => x.id === id)
  if (!u) throw new Error(id)
  return u
}

/** Закрыть заявку так же, как обработчик decide */
function close(r: Request): void {
  r.status = r.steps.some((s) => s.status === 'rejected') ? 'rejected' : 'approved'
  applyOutcome(r)
}

describe('мок-справочники', () => {
  it('схемы справочников валидны', () => {
    const ids = catalogs.map((c) => c.id)
    for (const c of catalogs) expect(validateCatalog(c, ids, ['cls-tool', 'cls-fastener', 'cls-material', 'cls-okpd2', 'cls-eskd'])).toEqual([])
  })
})

describe('пополнение по обходному листу', () => {
  beforeEach(() => resetDb())

  const dto = {
    title: 'Пополнение: Кронштейн',
    targetType: 'catalog-element' as const,
    targetId: 'cat-nomenclature',
    payload: { name: 'Кронштейн', attributes: { name: 'Кронштейн', article: 'KR-1' } },
  }

  it('свой шаблон справочника приоритетнее общего', () => {
    expect(findWorkflow('catalog-element', 'cat-nomenclature')?.id).toBe('wf-element-nomenclature')
    expect(findWorkflow('catalog-element', 'cat-units')?.id).toBe('wf-element-default')
    expect(findWorkflow('element-edit', 'cat-nomenclature')).toBeUndefined()
  })

  it('маршрут зависит от группы позиции', () => {
    const steps = (parentId?: string) =>
      openRequest({ ...dto, payload: { ...dto.payload, ...(parentId ? { parentId } : {}) } }, user('u-user'))!.steps.map((s) => s.id)
    expect(steps('g-cutting')).toEqual(['st-enc-tool', 'st-review']) // инструмент: группа с подгруппами
    expect(steps('g-metal')).toEqual(['st-enc-material', 'st-review'])
    expect(steps('g-fasteners')).toEqual(['st-enc-fastener', 'st-review'])
    expect(steps('g-own')).toEqual(['st-enc-eskd', 'st-review'])
    expect(steps()).toEqual(['st-review']) // без группы — только проверка
  })

  it('у строк есть срок: создание заявки + нормативные часы', () => {
    const req = openRequest({ ...dto, payload: { ...dto.payload, parentId: 'g-cutting' } }, user('u-user'))!
    const [tool, review] = req.steps
    expect(Date.parse(tool!.dueAt!) - Date.parse(req.createdAt)).toBe(16 * 3_600_000)
    expect(Date.parse(review!.dueAt!) - Date.parse(req.createdAt)).toBe(8 * 3_600_000)
  })

  it('элемент появляется только после прохождения листа, с шифром из строки шифрования', () => {
    const before = db.elements.length
    const req = openRequest({ ...dto, payload: { ...dto.payload, parentId: 'g-cutting' } }, user('u-user'))!
    expect(db.elements.length).toBe(before) // отложенное применение

    const [tool, review] = req.steps
    // Каждый модератор — только свою строку
    expect(canDecideStep(user('u-petrov').assignments, req, tool!)).toBe(true)
    expect(canDecideStep(user('u-kuznetsova').assignments, req, tool!)).toBe(false)
    expect(canDecideStep(user('u-user').assignments, req, review!)).toBe(false)

    Object.assign(tool!, { status: 'approved', result: { classifierId: 'cls-tool', catalogId: 'cat-cutting', code: 'X1', decoded: 'd', shortName: 's' } })
    review!.status = 'approved'
    close(req)

    const el = db.elements.at(-1)!
    expect(db.elements.length).toBe(before + 1)
    expect(el.attributes['article']).toBe('KR-1')
    expect(el.parentId).toBe('g-cutting')
    expect(el.codes?.map((c) => [c.classifierId, c.code, c.status])).toEqual([['cls-tool', 'X1', 'approved']])
  })

  it('ответственным приходят уведомления, автору — итог', () => {
    const req = openRequest({ ...dto, payload: { ...dto.payload, parentId: 'g-metal' } }, user('u-user'))!
    const forPetrov = db.notifications.filter((n) => n.userId === 'u-petrov' && n.requestId === req.id)
    const forKuznetsova = db.notifications.filter((n) => n.userId === 'u-kuznetsova' && n.requestId === req.id)
    expect(forPetrov.length).toBe(1) // проверка (модератор номенклатуры)
    expect(forKuznetsova.length).toBe(1) // шифрование материала
    req.steps[1]!.status = 'rejected'
    req.steps[1]!.comment = 'Дубль позиции KR-20-45'
    close(req)
    expect(db.notifications.at(-1)).toMatchObject({ userId: 'u-user', title: 'Заявка отклонена' })
  })

  it('заявку видят автор, ответственные и администратор', () => {
    const req = openRequest({ ...dto, payload: { ...dto.payload, parentId: 'g-metal' } }, user('u-user'))!
    expect(canSeeRequest(user('u-user').assignments, 'u-user', req)).toBe(true)
    expect(canSeeRequest(user('u-kuznetsova').assignments, 'u-kuznetsova', req)).toBe(true)
    expect(canSeeRequest(user('u-admin').assignments, 'u-admin', req)).toBe(true)
    expect(canSeeRequest(user('u-ivanov').assignments, 'u-ivanov', req)).toBe(false)
  })
})

describe('замещение на время отсутствия', () => {
  beforeEach(() => resetDb())
  const NOW = Date.parse('2026-11-05T09:00:00Z')

  it('строки отсутствующего адресуются заместителю', () => {
    const req = openRequest(
      { title: 'Пополнение: Болт', targetType: 'catalog-element', targetId: 'cat-nomenclature', payload: { name: 'Болт', parentId: 'g-fasteners' } },
      user('u-user'),
    )!
    const fastener = req.steps[0]!
    expect(responsibleUsers(db.users, req, fastener, NOW)).toEqual([{ userId: 'u-zakharova', deputyFor: 'u-orlov' }])
    // После отпуска — снова сам ответственный
    expect(responsibleUsers(db.users, req, fastener, Date.parse('2026-12-02T09:00:00Z'))).toEqual([{ userId: 'u-orlov' }])
  })

  it('заместитель решает строку от имени отсутствующего, роль администратора не передаётся', () => {
    const req = db.requests.find((r) => r.id === 'req-7')!
    const step = req.steps.find((s) => s.id === 'st-enc-fastener')!
    const zakharova = user('u-zakharova')
    const delegations = delegationsOf(zakharova.id, db.users, NOW)
    expect(delegations.map((d) => d.userId)).toEqual(['u-orlov'])
    expect(canDecideStep(zakharova.assignments, req, step)).toBe(false)
    expect(canDecideStep(actingAssignments(zakharova.assignments, delegations), req, step)).toBe(true)
    expect(onBehalfOf(zakharova.assignments, delegations, req, step)).toBe('u-orlov')
    // Отсутствующий администратор не передаёт свои права
    user('u-admin').absence = { from: '2026-11-01T00:00:00Z', until: '2026-11-30T00:00:00Z', deputyId: 'u-user', reason: 'Отпуск' }
    expect(delegationsOf('u-user', db.users, NOW)[0]?.assignments).toEqual([])
  })

  it('просрочка строки', () => {
    expect(isOverdue({ status: 'pending', dueAt: '2026-11-04T00:00:00Z' }, NOW)).toBe(true)
    expect(isOverdue({ status: 'approved', dueAt: '2026-11-04T00:00:00Z' }, NOW)).toBe(false)
    expect(isOverdue({ status: 'pending' }, NOW)).toBe(false)
  })
})

describe('корректировка', () => {
  beforeEach(() => resetDb())

  it('без перешифровки шаблона нет — применяется сразу (обработчик)', () => {
    expect(openRequest({ title: 't', targetType: 'element-edit', targetId: 'cat-nomenclature', payload: { elementId: 'n-0002', attributes: { price: 1 } } }, user('u-user'))).toBeNull()
  })

  it('с перешифровкой — строка шифрования модератору классификатора, обязательная', () => {
    const req = openRequest(
      { title: 't', targetType: 'element-edit', targetId: 'cat-nomenclature', payload: { elementId: 'n-0001', attributes: { price: 1999 }, recode: ['cls-tool'] } },
      user('u-user'),
    )!
    expect(req.steps.map((s) => [s.kind, s.classifierId, s.optional])).toEqual([['encode', 'cls-tool', false]])
    Object.assign(req.steps[0]!, { status: 'approved', result: { classifierId: 'cls-tool', catalogId: 'cat-cutting', code: 'NEW', decoded: 'd', shortName: 's' } })
    close(req)
    const el = db.elements.find((e) => e.id === 'n-0001')!
    expect(el.attributes['price']).toBe(1999)
    expect(el.codes?.find((c) => c.classifierId === 'cls-tool')?.code).toBe('NEW')
    expect(el.history.some((h) => h.type === 'attribute' && h.attributeId === 'price')).toBe(true)
  })
})

describe('реестр шифров', () => {
  beforeEach(() => resetDb())

  it('дубликат ищется по записям, шифрам элементов и подобранным в заявках шифрам', () => {
    expect(findCodeConflict('cls-tool', 'cat-cutting', 'ГОСТ109020H8C-57-6.5AH1SV').source).toBe('entry')
    db.entries = []
    expect(findCodeConflict('cls-tool', 'cat-cutting', 'гост109020h8c-57-6.5ah1sv').element?.elementId).toBe('n-0001')
    const req = db.requests.find((r) => r.id === 'req-1')!
    req.steps[0]!.result = { classifierId: 'cls-tool', catalogId: 'cat-cutting', code: 'ZZZ', decoded: '', shortName: '' }
    expect(findCodeConflict('cls-tool', 'cat-cutting', 'zzz')).toMatchObject({ source: 'request', requestId: 'req-1' })
    expect(findCodeConflict('cls-tool', 'cat-cutting', 'zzz', undefined, 'req-1').duplicate).toBe(false)
  })

  it('свой же элемент не считается дубликатом (переприсвоение)', () => {
    db.entries = []
    expect(findCodeConflict('cls-tool', 'cat-cutting', 'ГОСТ109020H8C-57-6.5AH1SV', 'n-0001').duplicate).toBe(false)
  })
})
