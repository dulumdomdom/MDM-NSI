// «Сервер» интеграций: события, импорт, пакетные запуски, расписание.

import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDb } from '../db'
import { onElementChanged, runDueFlows, runFlow } from '../integration'
import { applyOutcome } from '../workflow'

const flow = (id: string) => {
  const f = db.flows.find((x) => x.id === id)
  if (!f) throw new Error(id)
  return f
}

describe('интеграции', () => {
  beforeEach(() => resetDb())

  it('изменение элемента выгружается во все подходящие системы по событию', () => {
    const el = db.elements.find((e) => e.id === 'n-0001')!
    const recs = onElementChanged(el)
    // 1С и АСУ — всё действующее; Imbase — только с утверждённым шифром инструмента (он есть)
    expect(recs.map((r) => [r.systemId, r.status]).sort()).toEqual([
      ['1c', 'success'],
      ['asu', 'success'],
      ['imbase', 'success'],
    ])
    expect(el.externalRefs?.find((r) => r.systemId === '1c')?.externalId).toBe('НФ-00012871') // прежний id сохранён
  })

  it('черновик и элемент без шифра в Imbase не уходят', () => {
    const draft = db.elements.find((e) => e.id === 'n-0002')!
    expect(onElementChanged(draft)).toEqual([])
    const bolt = db.elements.find((e) => e.state === 'active' && e.attributes['article'] && !e.codes?.length && !e.isGroup)!
    expect(onElementChanged(bolt).map((r) => r.systemId).sort()).toEqual(['1c', 'asu'])
  })

  it('незаполненное обязательное поле — ошибка в журнале и у элемента', () => {
    const el = db.elements.find((e) => e.id === 'n-0001')!
    el.attributes = { ...el.attributes, unit: null }
    const recs = onElementChanged(el)
    expect(recs.find((r) => r.systemId === '1c')).toMatchObject({ status: 'error', message: 'Не заполнено: ЕдиницаИзмерения' })
    expect(el.externalRefs?.find((r) => r.systemId === '1c')?.status).toBe('error')
  })

  it('импорт из Imbase создаёт заявки модераторам и не дублирует их', () => {
    const before = db.requests.length
    runFlow(flow('fl-imbase-standard'), 'manual')
    const created = db.requests.slice(before)
    expect(created.map((r) => r.createdBy)).toEqual(['u-int-imbase', 'u-int-imbase'])
    expect(created[0]?.payload.source).toEqual({ systemId: 'imbase', externalId: 'IMB.0107.0332' })
    // Повторный запуск — ничего нового
    const again = runFlow(flow('fl-imbase-standard'), 'manual')
    expect(db.requests.length).toBe(before + 2)
    expect(again.summary).toBe('Новых записей нет')
  })

  it('утверждённая позиция из Imbase связана со своей записью там', () => {
    runFlow(flow('fl-imbase-standard'), 'manual')
    const req = db.requests.at(-1)!
    req.steps.forEach((s) => (s.status = s.kind === 'encode' ? 'skipped' : 'approved'))
    req.status = 'approved'
    applyOutcome(req)
    const el = db.elements.at(-1)!
    expect(el.externalRefs?.find((r) => r.systemId === 'imbase')?.externalId).toBe('IMB.0107.0418')
    expect(el.parentId).toBe('g-fasteners')
  })

  it('контрагенты из 1С поступают сразу (1С — мастер-система)', () => {
    const before = db.elements.filter((e) => e.catalogId === 'cat-counterparties').length
    runFlow(flow('fl-1c-counterparties'), 'manual')
    expect(db.elements.filter((e) => e.catalogId === 'cat-counterparties').length).toBe(before + 1)
  })

  it('пакетная выгрузка: одна сводная запись в журнале', () => {
    const before = db.journal.length
    const res = runFlow(flow('fl-1c-nomenclature'), 'manual')
    expect(res.summary).toMatch(/^Пакетная выгрузка: передано \d+/)
    expect(db.journal.length - before).toBe(res.records.length)
  })

  it('расписание: запускаются только потоки, у которых подошёл срок', () => {
    const now = Date.parse('2026-11-04T08:30:00Z')
    expect(runDueFlows(now).map((r) => r.flow.id)).toEqual([])
    const later = Date.parse('2026-11-04T09:01:00Z')
    expect(runDueFlows(later).map((r) => r.flow.id).sort()).toEqual(['fl-asu-nomenclature', 'fl-imbase-standard'])
  })
})
