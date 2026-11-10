// Сценарий редактирования элемента справочника: открыть/создать, состояние, группа, сохранение, перенос.

import { computed, ref } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import { useAuthStore } from '@/stores/auth'
import type { CatalogElement } from '@/types'
import { textOf } from '@/lib/attributes'
import { useDynamicForm } from './useDynamicForm'

export function useElementEditor() {
  const store = useCatalogStore()
  const auth = useAuthStore()

  const visible = ref(false)
  const editing = ref<CatalogElement | null>(null)
  const state = ref('')
  const parentId = ref<string | null>(null)
  const isGroup = ref(false)
  const saving = ref(false)

  /** В форме — только колонки, разрешённые RBAC */
  const attributes = computed(() => store.visibleAttributes)
  const form = useDynamicForm(attributes)

  const catalogId = computed(() => store.currentCatalog?.id ?? '')
  const canCreate = computed(() => auth.can('catalog', catalogId.value, 'create'))
  const canUpdate = computed(() => auth.can('catalog', catalogId.value, 'update'))
  const canDelete = computed(() => auth.can('catalog', catalogId.value, 'delete'))
  const readonly = computed(() => (editing.value ? !canUpdate.value : !canCreate.value))

  const groupOptions = computed(() =>
    store.accessibleElements
      .filter((e) => e.isGroup && e.id !== editing.value?.id)
      .map((e) => ({ id: e.id, label: textOf(e.attributes['name'], e.id) })),
  )

  function openNew(asGroup = false): void {
    editing.value = null
    isGroup.value = asGroup
    state.value = store.currentCatalog?.states.find((s) => s.initial)?.id ?? store.currentCatalog?.states[0]?.id ?? ''
    parentId.value = store.currentParentId
    form.reset()
    visible.value = true
  }

  function openExisting(el: CatalogElement): void {
    editing.value = el
    isGroup.value = !!el.isGroup
    state.value = el.state
    parentId.value = el.parentId ?? null
    form.reset(el.attributes)
    visible.value = true
  }

  async function save(): Promise<boolean> {
    // Группе достаточно наименования — остальные обязательные атрибуты к ней не относятся
    if (!isGroup.value && !form.validate()) return false
    saving.value = true
    try {
      const dto = {
        // Значения скрытых по RBAC колонок сохраняем как были — пользователь их не видел и не менял
        attributes: { ...(editing.value?.attributes ?? {}), ...form.model.value },
        state: state.value,
        ...(parentId.value ? { parentId: parentId.value } : {}),
        ...(isGroup.value ? { isGroup: true } : {}),
      }
      const saved = await store.saveElement(dto, editing.value?.id)
      if (saved && editing.value && (editing.value.parentId ?? null) !== parentId.value) {
        await store.moveElement(saved.id, parentId.value)
      }
      if (saved) visible.value = false
      return saved !== null
    } finally {
      saving.value = false
    }
  }

  return {
    visible,
    editing,
    state,
    parentId,
    isGroup,
    saving,
    attributes,
    form,
    readonly,
    canCreate,
    canDelete,
    groupOptions,
    openNew,
    openExisting,
    save,
  }
}
