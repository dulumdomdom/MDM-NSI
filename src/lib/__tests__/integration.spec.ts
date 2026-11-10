import { describe, expect, it } from 'vitest'
import { catalogs, catalogElements } from '@/mocks/data/catalogs'
import type { IntegrationFlow } from '@/types'
import { buildPayload, checkExport, describeTrigger, externalIdFor, mappingValue } from '../integration'

const nomenclature = catalogs.find((c) => c.id === 'cat-nomenclature')!
const drill = catalogElements.find((e) => e.id === 'n-0001')!
const draft = catalogElements.find((e) => e.id === 'n-0002')!

const flow: IntegrationFlow = {
  id: 'f',
  systemId: '1c',
  catalogId: 'cat-nomenclature',
  name: 'Номенклатура в 1С',
  direction: 'export',
  trigger: { onEvent: true, schedule: 'daily' },
  states: ['active'],
  requireCodes: ['cls-tool'],
  mapping: [
    { source: 'name', target: 'Наименование', required: true },
    { source: 'unit', target: 'ЕдиницаИзмерения', required: true },
    { source: 'code:cls-tool', target: 'КодКлассификатора' },
    { source: 'drawing', target: 'Чертёж', required: true },
  ],
  importMode: 'direct',
  enabled: true,
}

describe('интеграции', () => {
  it('значения источников: атрибут, ссылка, шифр, состояние', () => {
    expect(mappingValue(drill, 'unit', nomenclature)).toBe('шт')
    expect(mappingValue(drill, 'code:cls-tool', nomenclature)).toBe('ГОСТ109020H8C-57-6.5AH1SV')
    expect(mappingValue(drill, '$state', nomenclature)).toBe('Действует')
  })

  it('фильтры потока: состояние и утверждённый шифр', () => {
    expect(checkExport(flow, drill).eligible).toBe(true)
    expect(checkExport(flow, draft)).toMatchObject({ eligible: false })
    expect(checkExport({ ...flow, states: [] }, draft).reason).toBe('нет утверждённого шифра')
  })

  it('незаполненное обязательное поле не даёт выгрузить запись', () => {
    const p = buildPayload(flow.mapping, drill, nomenclature)
    expect(p.fields['Наименование']).toContain('Сверло')
    expect(p.missing).toEqual([])
    const noDrawing = { ...drill, attributes: { ...drill.attributes, drawing: null } }
    expect(buildPayload(flow.mapping, noDrawing, nomenclature).missing).toEqual(['Чертёж'])
  })

  it('подписи и идентификаторы', () => {
    expect(describeTrigger({ onEvent: true, schedule: 'daily' })).toBe('при изменении + ежедневно')
    expect(describeTrigger({ onEvent: false, schedule: 'none' })).toBe('вручную')
    expect(externalIdFor('1c', 'n-0001')).toMatch(/^НФ-\d{8}$/)
    expect(externalIdFor('1c', 'n-0001')).toBe(externalIdFor('1c', 'n-0001'))
  })
})
