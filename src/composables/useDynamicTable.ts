// Модель таблицы справочника: колонки и строки уже прошли RBAC в catalog store.
// Компонент DynamicTable получает готовые данные и только рендерит их.

import { computed } from 'vue'
import { useCatalogStore } from '@/stores/catalog'
import type { CatalogState } from '@/types'

/** Высота строки для виртуального скроллера (px) — должна совпадать со стилями строки */
export const ROW_HEIGHT = 40

export function useDynamicTable() {
  const store = useCatalogStore()

  const columns = computed(() => store.visibleAttributes.filter((a) => a.listed !== false))
  const rows = computed(() => store.visibleElements)
  const states = computed<CatalogState[]>(() => store.currentCatalog?.states ?? [])
  const hierarchical = computed(() => store.currentCatalog?.hierarchical ?? false)
  const total = computed(() => store.accessibleElements.filter((e) => !e.isGroup).length)

  return {
    columns,
    rows,
    states,
    hierarchical,
    total,
    loading: computed(() => store.loading),
    virtualScrollerOptions: { itemSize: ROW_HEIGHT },
  }
}
