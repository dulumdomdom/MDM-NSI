// Пополнение и корректировка справочника — сценарий пользователя:
//  1) ввод наименования спецификации → умный поиск по справочнику (наименование, свойства, шифры);
//  2а) найдено → выбрать элемент, поправить изменившиеся свойства; шифр менять не нужно — корректировка
//      вносится сразу, нужно — уходит модераторам на перешифровку;
//  2б) не найдено → поля дозаполняются из запроса, создаётся заявка на пополнение;
//  3) заявка проходит обходной лист (модераторы шифруют своими классификаторами), затем элемент
//     появляется в справочнике.

import { groupChain, stepApplies } from '@/lib/routing'
import { computed, ref } from 'vue'
import { formatAttribute, textOf } from '@/lib/attributes'
import { draftFromQuery, parseQuery, smartSearch, type SearchField } from '@/lib/smartSearch'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { useRequestStore } from '@/stores/request'
import { useUiStore } from '@/stores/ui'
import type { AttributeValue, CatalogElement, CreateRequestResult, ReferenceValue } from '@/types'
import { useDynamicForm } from './useDynamicForm'

export type IntakeMode = 'search' | 'edit' | 'new' | 'done'

/** Порог «уверенного» совпадения: выше — предлагаем корректировку, ниже — пополнение */
export const CONFIDENT_SCORE = 0.75

const same = (a: AttributeValue | undefined, b: AttributeValue | undefined): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function useIntake() {
  const catalogs = useCatalogStore()
  const auth = useAuthStore()
  const requests = useRequestStore()
  const ui = useUiStore()

  const catalogId = ref<string | null>(null)
  const query = ref('')
  const mode = ref<IntakeMode>('search')
  const selected = ref<CatalogElement | null>(null)
  /** Корректировка: по каким классификаторам перешифровать */
  const recode = ref<string[]>([])
  const parentId = ref<string | null>(null)
  /** Группа предложена по похожей позиции (её наименование) */
  const suggestedFrom = ref<string | null>(null)
  /** Атрибуты, заполненные автоматически из запроса */
  const autoFilled = ref<string[]>([])
  const submitting = ref(false)
  /** Справочник и варианты ссылок загружены — можно разбирать запрос */
  const ready = ref(false)
  const result = ref<CreateRequestResult | null>(null)
  const referenceOptions = ref<Record<string, ReferenceValue[]>>({})

  /** Справочники, в которые пользователь может подавать заявки */
  const available = computed(() => catalogs.summaries.filter((c) => auth.can('catalog', c.id, 'read')))
  const catalog = computed(() => catalogs.currentCatalog)
  const attributes = computed(() => catalogs.visibleAttributes)
  const displayAttr = computed(() => catalog.value?.displayAttributeId ?? 'name')
  const bindings = computed(() => catalog.value?.classifierBindings ?? [])

  const form = useDynamicForm(attributes)

  async function init(): Promise<void> {
    await catalogs.loadList()
    if (requests.workflows.length === 0) void requests.load()
    const first = available.value.find((c) => c.id === 'cat-nomenclature') ?? available.value[0]
    // Первичная загрузка не сбрасывает то, что пользователь уже успел ввести
    if (first) await loadCatalog(first.id)
  }

  /** Пользователь сменил справочник — начинаем заново */
  async function selectCatalog(id: string): Promise<void> {
    await loadCatalog(id)
    backToSearch()
  }

  async function loadCatalog(id: string): Promise<void> {
    ready.value = false
    catalogId.value = id
    await catalogs.open(id)
    await catalogs.loadClassifiers(bindings.value.map((b) => b.classifierId))
    // Варианты ссылочных атрибутов — для распознавания «шт», «кг» в запросе
    const refs = attributes.value.filter((a) => a.type === 'reference' && a.referenceCatalogId)
    const loaded = await Promise.all(refs.map(async (a) => [a.id, await catalogs.referenceOptions(a.referenceCatalogId ?? '', a.referenceDisplayAttributeId)] as const))
    referenceOptions.value = Object.fromEntries(loaded)
    ready.value = true
  }

  /* ------------------------------ поиск ------------------------------ */

  const classifierName = (id: string) => catalogs.classifiers[id]?.name ?? id

  /** Поля элемента для поиска: наименование, остальные видимые свойства, шифры */
  function fieldsOf(el: CatalogElement): SearchField[] {
    const name = attributes.value.find((a) => a.id === displayAttr.value)
    return [
      ...(name ? [{ id: name.id, label: name.name, text: textOf(el.attributes[name.id]), weight: 1 }] : []),
      ...attributes.value
        .filter((a) => a.id !== displayAttr.value)
        .map((a) => ({ id: a.id, label: a.name, text: formatAttribute(a, el.attributes[a.id]), weight: 0.9 })),
      ...(el.codes ?? []).map((c) => ({ id: `code:${c.classifierId}`, label: `Шифр (${classifierName(c.classifierId)})`, text: c.code, weight: 1 })),
    ]
  }

  const parsed = computed(() => parseQuery(query.value, attributes.value))
  const items = computed(() => catalogs.accessibleElements.filter((e) => !e.isGroup))
  const hits = computed(() => (query.value.trim().length >= 2 ? smartSearch(items.value, fieldsOf, parsed.value, { limit: 8 }) : []))
  const confident = computed(() => (hits.value[0]?.score ?? 0) >= CONFIDENT_SCORE)

  /* ---------------------------- корректировка ---------------------------- */

  function startEdit(el: CatalogElement): void {
    selected.value = el
    recode.value = []
    autoFilled.value = []
    form.reset(el.attributes)
    mode.value = 'edit'
  }

  /** Изменённые пользователем атрибуты */
  const changes = computed(() => {
    const el = selected.value
    if (!el) return [] as string[]
    return attributes.value.filter((a) => !same(form.model.value[a.id], el.attributes[a.id])).map((a) => a.id)
  })

  const codeOf = (classifierId: string) => selected.value?.codes?.find((c) => c.classifierId === classifierId)

  /* ------------------------------ пополнение ------------------------------ */

  function startNew(): void {
    const draft = draftFromQuery(query.value, attributes.value, displayAttr.value, referenceOptions.value)
    selected.value = null
    autoFilled.value = draft.filled
    // Группа: открытая в справочнике, иначе — группа самой похожей позиции (от неё зависит маршрут заявки)
    const similar = hits.value[0]?.item
    parentId.value = catalogs.currentParentId ?? similar?.parentId ?? null
    suggestedFrom.value = !catalogs.currentParentId && similar?.parentId ? textOf(similar.attributes[displayAttr.value], similar.id) : null
    form.reset(draft.values)
    mode.value = 'new'
  }

  /** Обходной лист, который пройдёт заявка (для подсказки пользователю) */
  const route = computed(() => {
    const id = catalogId.value ?? ''
    const all = catalogs.accessibleElements
    if (mode.value === 'new') {
      const chain = groupChain(parentId.value, all)
      return (requests.effectiveWorkflow('catalog-element', id)?.steps ?? []).filter((s) => stepApplies(s, chain))
    }
    const encode = (requests.effectiveWorkflow('catalog-element', id)?.steps ?? []).filter((s) => s.kind === 'encode' && recode.value.includes(s.classifierId ?? ''))
    return [...encode, ...(requests.effectiveWorkflow('element-edit', id)?.steps ?? [])]
  })

  /** Корректировка без перешифровки и без листа — применяется сразу */
  const appliesImmediately = computed(() => mode.value === 'edit' && route.value.length === 0)

  const groupOptions = computed(() =>
    catalogs.accessibleElements.filter((e) => e.isGroup).map((e) => ({ id: e.id, label: textOf(e.attributes[displayAttr.value], e.id) })),
  )

  const canSubmit = computed(() => {
    if (submitting.value) return false
    if (mode.value === 'edit') return changes.value.length > 0 || recode.value.length > 0
    return mode.value === 'new'
  })

  /* ------------------------------ отправка ------------------------------ */

  async function submit(): Promise<void> {
    const id = catalogId.value
    if (!id || !canSubmit.value || !form.validate()) return
    submitting.value = true
    const isEdit = mode.value === 'edit'
    try {
      const name = textOf(form.model.value[displayAttr.value], 'без наименования')
      const res =
        !isEdit
          ? await requests.create({
              title: `Пополнение: ${name}`,
              targetType: 'catalog-element',
              targetId: id,
              payload: { name, attributes: { ...form.model.value }, query: query.value, ...(parentId.value ? { parentId: parentId.value } : {}) },
            })
          : await requests.create({
              title: `Корректировка: ${name}`,
              targetType: 'element-edit',
              targetId: id,
              payload: {
                name,
                elementId: selected.value?.id ?? '',
                attributes: Object.fromEntries(changes.value.map((a) => [a, form.model.value[a] ?? null])),
                query: query.value,
                ...(recode.value.length ? { recode: [...recode.value] } : {}),
              },
            })
      if (!res) return
      result.value = res
      mode.value = 'done'
      if (res.applied) {
        ui.notify('success', isEdit ? 'Корректировка внесена' : 'Элемент добавлен', 'Обходной лист не требуется')
        await catalogs.open(id) // свежие данные справочника
      } else {
        ui.notify('success', 'Заявка отправлена модераторам', `№ ${res.request?.id ?? ''}`)
      }
    } finally {
      submitting.value = false
    }
  }

  function backToSearch(): void {
    mode.value = 'search'
    selected.value = null
    result.value = null
    recode.value = []
    autoFilled.value = []
  }

  function startOver(): void {
    query.value = ''
    backToSearch()
  }

  return {
    catalogId,
    query,
    mode,
    selected,
    recode,
    parentId,
    suggestedFrom,
    autoFilled,
    submitting,
    ready,
    result,
    available,
    catalog,
    attributes,
    bindings,
    form,
    parsed,
    hits,
    confident,
    changes,
    route,
    appliesImmediately,
    groupOptions,
    canSubmit,
    classifierName,
    codeOf,
    init,
    selectCatalog,
    startEdit,
    startNew,
    submit,
    backToSearch,
    startOver,
  }
}
