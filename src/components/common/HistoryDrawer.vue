<script setup lang="ts">
// История редактирования элемента — 3 типа: изменения атрибутов, смены состояний, версии.
import { computed } from 'vue'
import Drawer from 'primevue/drawer'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import { formatAttribute } from '@/lib/attributes'
import type { CatalogAttribute, CatalogElement, CatalogState, EditHistory, EditHistoryType } from '@/types'

const props = defineProps<{ element: CatalogElement | null; attributes: CatalogAttribute[]; states: CatalogState[] }>()
const visible = defineModel<boolean>('visible', { required: true })

const TABS: { type: EditHistoryType; label: string; icon: string }[] = [
  { type: 'attribute', label: 'Атрибуты', icon: 'pi pi-pencil' },
  { type: 'state', label: 'Состояния', icon: 'pi pi-sync' },
  { type: 'version', label: 'Версии', icon: 'pi pi-clone' },
]

const dt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
const byType = computed(() => {
  const all = [...(props.element?.history ?? [])].sort((a, b) => b.at.localeCompare(a.at))
  return (t: EditHistoryType): EditHistory[] => all.filter((h) => h.type === t)
})
const attr = (id: string) => props.attributes.find((a) => a.id === id)
const stateName = (id: string) => props.states.find((s) => s.id === id)?.name ?? id
// Колонки, скрытые RBAC, в истории тоже не показываем
const visibleAttrChange = (h: EditHistory) => h.type !== 'attribute' || !!attr(h.attributeId)
const fmt = (attrId: string, v: Parameters<typeof formatAttribute>[1]) => {
  const a = attr(attrId)
  return a ? formatAttribute(a, v) || '∅' : ''
}
</script>

<template>
  <Drawer v-model:visible="visible" position="right" header="История изменений" class="!w-full md:!w-[34rem]">
    <Tabs value="attribute">
      <TabList>
        <Tab v-for="t in TABS" :key="t.type" :value="t.type">
          <i :class="t.icon" class="mr-1 text-xs" />{{ t.label }} ({{ byType(t.type).filter(visibleAttrChange).length }})
        </Tab>
      </TabList>
      <TabPanels>
        <TabPanel v-for="t in TABS" :key="t.type" :value="t.type">
          <UiEmpty v-if="byType(t.type).filter(visibleAttrChange).length === 0" text="Записей нет" icon="pi pi-history" />
          <ol class="flex flex-col gap-3">
            <li v-for="h in byType(t.type).filter(visibleAttrChange)" :key="h.id" class="rounded-lg border border-line p-3 text-sm">
              <div class="mb-1 flex justify-between text-xs text-ink-3">
                <span>{{ dt.format(new Date(h.at)) }}</span>
                <span>{{ h.userId }}</span>
              </div>
              <template v-if="h.type === 'attribute'">
                <div class="font-medium">{{ attr(h.attributeId)?.name }}</div>
                <div class="mt-1 flex flex-wrap items-center gap-2">
                  <span class="rounded bg-red-50 px-1.5 text-red-700 line-through">{{ fmt(h.attributeId, h.oldValue) }}</span>
                  <i class="pi pi-arrow-right text-xs text-ink-3" />
                  <span class="rounded bg-green-50 px-1.5 text-green-700">{{ fmt(h.attributeId, h.newValue) }}</span>
                </div>
              </template>
              <template v-else-if="h.type === 'state'">
                <div>{{ stateName(h.fromState) }} → <b>{{ stateName(h.toState) }}</b></div>
                <div v-if="h.comment" class="mt-1 text-ink-3">{{ h.comment }}</div>
              </template>
              <template v-else>
                <div class="font-medium">Версия {{ h.version }}</div>
                <div class="mt-1 text-xs text-ink-3">Полей в снимке: {{ Object.keys(h.snapshot).length }}</div>
              </template>
            </li>
          </ol>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </Drawer>
</template>
