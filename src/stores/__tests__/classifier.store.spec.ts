// Оба режима ввода пишут в один store и дают одинаковый результат.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { toolClassifier } from '@/mocks/data/classifiers/tool'
import { DRILL_CODE, DRILL_VALUES } from '@/lib/classifier/__tests__/fixtures'
import { useClassifierStore } from '../classifier'

const api = vi.hoisted(() => ({
  duplicateCheck: vi.fn(),
  create: vi.fn(),
}))

vi.mock('@/api', () => ({
  classifierApi: { duplicateCheck: api.duplicateCheck, get: vi.fn(), list: vi.fn() },
  requestApi: { create: api.create },
  errorMessage: (e: unknown) => String(e),
}))

describe('classifier store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    api.duplicateCheck.mockReset()
    api.create.mockReset()
  })

  it('режим и каталог берутся из конфига', () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    expect(s.activeInputMode).toBe('wizard')
    expect(s.catalogId).toBe('cat-cutting')
    s.setMode('direct')
    expect(s.activeInputMode).toBe('direct')
  })

  it('direct → wizard: setCode заполняет значения фасетов', () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    s.setCode(DRILL_CODE)
    expect(s.facetValues).toMatchObject(DRILL_VALUES)
    expect(s.decodedString.startsWith('Сверло спиральное')).toBe(true)
    expect(s.shortName).toBe('Сверло спиральное Ø6.5×57 H')
  })

  it('wizard → direct: setFacet собирает тот же шифр', () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    for (const [id, v] of Object.entries(DRILL_VALUES)) s.setFacetById(id, v)
    expect(s.inputCode).toBe(DRILL_CODE)
    expect(s.canSubmit).toBe(true)
  })

  it('setFacet по индексу и реактивные зависимости', () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    s.setFacet(0, 'SV')
    s.setFacet(1, '3')
    expect(s.dependencyOverrides['f-steps']?.visible).toBe(true)
    expect(s.visibleFacets.some((f) => f.facetId === 'f-steps')).toBe(true)
  })

  it('navigateTree переключает ветку и ставит фокус', () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    s.navigateTree('m-f-teeth')
    expect(s.facetValues['f-group']).toBe('FR')
    expect(s.focusFacetId).toBe('f-teeth')
    s.navigateTree('ms-f-meas-range')
    expect(s.catalogId).toBe('cat-measuring')
  })

  it('submit: дубликат не создаёт заявку', async () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    s.setCode(DRILL_CODE)
    api.duplicateCheck.mockResolvedValue({ duplicate: true, source: 'entry' })
    const res = await s.submit()
    expect(res).toMatchObject({ ok: false, reason: 'duplicate' })
    expect(api.create).not.toHaveBeenCalled()
  })

  it('submit: невалидный шифр не уходит на сервер', async () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    s.setCode('SV')
    expect(await s.submit()).toEqual({ ok: false, reason: 'invalid' })
    expect(api.duplicateCheck).not.toHaveBeenCalled()
  })

  it('submit: создаёт заявку с шифром и расшифровкой', async () => {
    const s = useClassifierStore()
    s.setClassifier(toolClassifier)
    s.setCode(DRILL_CODE)
    api.duplicateCheck.mockResolvedValue({ duplicate: false })
    api.create.mockResolvedValue({ request: { id: 'req-x' }, applied: false })
    const res = await s.submit()
    expect(res.ok).toBe(true)
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ targetType: 'classifier-entry', payload: expect.objectContaining({ code: DRILL_CODE }) as unknown }),
    )
  })
})
