<script setup lang="ts">
// Таблица справочника по схеме. Виртуализация строк (тысячи элементов без лагов).
// Получает УЖЕ отфильтрованные RBAC колонки и строки (см. useDynamicTable / catalog store).
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import UiStateTag from '@/components/ui/UiStateTag.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import { attributeKind } from '@/lib/attributes'
import type { CatalogAttribute, CatalogElement, CatalogState, ElementCodeStatus } from '@/types'
import { CELL_COMPONENTS } from './cells'

const props = defineProps<{
  columns: CatalogAttribute[]
  rows: CatalogElement[]
  states: CatalogState[]
  loading?: boolean
  virtualScrollerOptions: { itemSize: number }
  /** Колонки шифров по привязанным классификаторам */
  codeColumns?: { classifierId: string; title: string; required: boolean }[]
}>()

/** Цвет точки статуса шифра */
const CODE_DOT: Record<ElementCodeStatus, string> = {
  approved: 'bg-emerald-500',
  on_approval: 'bg-brand',
  rejected: 'bg-red-500',
}
const codeOf = (row: CatalogElement, classifierId: string) => row.codes?.find((c) => c.classifierId === classifierId)
const emit = defineEmits<{ open: [row: CatalogElement]; enterGroup: [row: CatalogElement] }>()

function onRowClick(row: CatalogElement): void {
  if (row.isGroup) emit('enterGroup', row)
  else emit('open', row)
}
</script>

<template>
  <DataTable
    :value="rows"
    data-key="id"
    :loading="loading"
    scrollable
    scroll-height="flex"
    :virtual-scroller-options="virtualScrollerOptions"
    size="small"
    striped-rows
    row-hover
    class="h-full"
    :pt="{ bodyRow: { style: `height: ${virtualScrollerOptions.itemSize}px`, class: 'cursor-pointer' } }"
    data-testid="dynamic-table"
    @row-click="(e) => onRowClick(e.data as CatalogElement)"
  >
    <template #empty>
      <UiEmpty text="Нет элементов" />
    </template>
    <Column header="" style="width: 40px" frozen>
      <template #body="{ data }">
        <i :class="(data as CatalogElement).isGroup ? 'pi pi-folder text-brand' : 'pi pi-minus text-line-strong'" />
      </template>
    </Column>
    <Column v-for="col in columns" :key="col.id" :header="col.name" :style="{ minWidth: `${col.width ?? 160}px` }">
      <template #body="{ data }">
        <component :is="CELL_COMPONENTS[attributeKind(col.type)]" :attribute="col" :value="(data as CatalogElement).attributes[col.id]" />
      </template>
    </Column>
    <Column v-for="cc in props.codeColumns ?? []" :key="`code-${cc.classifierId}`" :header="cc.title" style="min-width: 240px">
      <template #body="{ data }">
        <span v-if="codeOf(data as CatalogElement, cc.classifierId)" class="flex items-center gap-2">
          <i class="h-1.5 w-1.5 shrink-0 rounded-full" :class="CODE_DOT[codeOf(data as CatalogElement, cc.classifierId)!.status]" />
          <span class="code-font truncate text-xs text-brand-dark">{{ codeOf(data as CatalogElement, cc.classifierId)?.code }}</span>
        </span>
        <span v-else-if="cc.required && !(data as CatalogElement).isGroup" class="text-xs font-medium text-red-600">нет шифра</span>
      </template>
    </Column>
    <Column header="Состояние" style="min-width: 140px">
      <template #body="{ data }">
        <UiStateTag :state-id="(data as CatalogElement).state" :states="states" />
      </template>
    </Column>
  </DataTable>
</template>
