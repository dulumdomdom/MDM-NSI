// Редактирование структуры справочника на черновике: свойства, атрибуты (в т.ч. составные),
// состояния, привязки классификаторов. Проверка целостности — lib/catalogSchema.

import { deepClone } from '@/lib/clone'
import { computed, ref, watch } from 'vue'
import { newAttribute, validateCatalog } from '@/lib/catalogSchema'
import { uniqueId } from '@/lib/ids'
import { useCatalogStore } from '@/stores/catalog'
import { useUiStore } from '@/stores/ui'
import type { AttributeType, Catalog, CatalogAttribute, CatalogState, ClassifierBinding } from '@/types'

const clone = (c: Catalog): Catalog => deepClone(c)

export type CatalogGeneralPatch = Partial<Pick<Catalog, 'name' | 'description' | 'hierarchical' | 'displayAttributeId'>>

export function useCatalogConfig(knownCatalogIds: () => string[], knownClassifierIds: () => string[]) {
  const store = useCatalogStore()
  const ui = useUiStore()

  const draft = ref<Catalog | null>(null)
  const saving = ref(false)

  watch(
    () => store.currentCatalog,
    (c) => (draft.value = c ? clone(c) : null),
    { immediate: true },
  )

  const issues = computed(() => (draft.value ? validateCatalog(draft.value, knownCatalogIds(), knownClassifierIds()) : []))
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(store.currentCatalog))

  function edit(fn: (c: Catalog) => Catalog): void {
    if (draft.value) draft.value = fn(draft.value)
  }

  const setGeneral = (patch: CatalogGeneralPatch) => edit((c) => ({ ...c, ...patch }))

  /* ------------------------------ атрибуты ------------------------------ */

  /** parentId — id составного атрибута, если поле добавляется внутрь него */
  function addAttribute(name: string, type: AttributeType, parentId?: string): void {
    edit((c) => {
      if (!parentId) return { ...c, attributes: [...c.attributes, newAttribute(name, c.attributes.map((a) => a.id), type)] }
      return {
        ...c,
        attributes: c.attributes.map((a) =>
          a.id === parentId ? { ...a, compositeFields: [...(a.compositeFields ?? []), newAttribute(name, (a.compositeFields ?? []).map((f) => f.id), type)] } : a,
        ),
      }
    })
  }

  function replaceAttribute(attr: CatalogAttribute, parentId?: string): void {
    edit((c) => ({
      ...c,
      attributes: c.attributes.map((a) => {
        if (!parentId) return a.id === attr.id ? attr : a
        if (a.id !== parentId) return a
        return { ...a, compositeFields: (a.compositeFields ?? []).map((f) => (f.id === attr.id ? attr : f)) }
      }),
    }))
  }

  function removeAttribute(id: string, parentId?: string): boolean {
    const c = draft.value
    if (!c) return false
    if (!parentId && c.displayAttributeId === id) {
      ui.notify('warn', 'Это атрибут-наименование', 'Сначала выберите другой атрибут-наименование')
      return false
    }
    edit((x) => ({
      ...x,
      attributes: parentId
        ? x.attributes.map((a) => (a.id === parentId ? { ...a, compositeFields: (a.compositeFields ?? []).filter((f) => f.id !== id) } : a))
        : x.attributes.filter((a) => a.id !== id),
    }))
    return true
  }

  function moveAttribute(id: string, delta: -1 | 1): void {
    edit((c) => {
      const list = [...c.attributes]
      const i = list.findIndex((a) => a.id === id)
      const a = list[i]
      const b = list[i + delta]
      if (!a || !b) return c
      list[i] = b
      list[i + delta] = a
      return { ...c, attributes: list }
    })
  }

  /* ------------------------------ состояния ------------------------------ */

  function addState(name: string): void {
    edit((c) => ({ ...c, states: [...c.states, { id: uniqueId('', name, c.states.map((s) => s.id)), name, color: 'secondary' }] }))
  }

  function updateState(id: string, patch: Partial<CatalogState>): void {
    edit((c) => ({
      ...c,
      // Начальное состояние — только одно
      states: c.states.map((s) => (s.id === id ? { ...s, ...patch } : patch.initial ? { ...s, initial: false } : s)),
    }))
  }

  const removeState = (id: string) => edit((c) => ({ ...c, states: c.states.filter((s) => s.id !== id) }))

  /* ------------------------------ привязки ------------------------------ */

  function addBinding(classifierId: string, classifierCatalogId?: string): void {
    edit((c) =>
      c.classifierBindings.some((b) => b.classifierId === classifierId)
        ? c
        : { ...c, classifierBindings: [...c.classifierBindings, { classifierId, required: false, ...(classifierCatalogId ? { classifierCatalogId } : {}) }] },
    )
  }

  const updateBinding = (classifierId: string, patch: Partial<ClassifierBinding>) =>
    edit((c) => ({ ...c, classifierBindings: c.classifierBindings.map((b) => (b.classifierId === classifierId ? { ...b, ...patch } : b)) }))

  const removeBinding = (classifierId: string) =>
    edit((c) => ({ ...c, classifierBindings: c.classifierBindings.filter((b) => b.classifierId !== classifierId) }))

  /* ------------------------------ сохранение ------------------------------ */

  async function save(): Promise<void> {
    const d = draft.value
    if (!d) return
    if (issues.value.length > 0) {
      ui.notify('warn', 'Структура содержит ошибки', issues.value.map((i) => `${i.where}: ${i.message}`).slice(0, 3).join('\n'))
      return
    }
    saving.value = true
    try {
      await store.saveCatalog(clone(d))
    } finally {
      saving.value = false
    }
  }

  const discard = () => (draft.value = store.currentCatalog ? clone(store.currentCatalog) : null)

  return {
    draft,
    issues,
    dirty,
    saving,
    setGeneral,
    addAttribute,
    replaceAttribute,
    removeAttribute,
    moveAttribute,
    addState,
    updateState,
    removeState,
    addBinding,
    updateBinding,
    removeBinding,
    save,
    discard,
  }
}
