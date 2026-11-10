<script setup lang="ts">
// Сопоставления элемента — 4 вида: синонимы, аналоги, давальческие, сертифицированные.
import { computed } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import type { ElementMatch, MatchType } from '@/types'

const props = defineProps<{ matches: ElementMatch[] }>()

const KINDS: { type: MatchType; label: string }[] = [
  { type: 'synonym', label: 'Синонимы' },
  { type: 'analog', label: 'Аналоги' },
  { type: 'supplier', label: 'Давальческие' },
  { type: 'certified', label: 'Сертифицированные' },
]

const grouped = computed(() => {
  const map = new Map<MatchType, ElementMatch[]>(KINDS.map((k) => [k.type, []]))
  for (const m of props.matches) map.get(m.type)?.push(m)
  return map
})
</script>

<template>
  <Tabs value="synonym">
    <TabList>
      <Tab v-for="k in KINDS" :key="k.type" :value="k.type">{{ k.label }} ({{ grouped.get(k.type)?.length ?? 0 }})</Tab>
    </TabList>
    <TabPanels>
      <TabPanel v-for="k in KINDS" :key="k.type" :value="k.type">
        <UiEmpty v-if="!grouped.get(k.type)?.length" text="Сопоставлений нет" icon="pi pi-link" />
        <ul class="flex flex-col gap-2">
          <li v-for="m in grouped.get(k.type)" :key="m.elementId" class="flex items-center gap-2 rounded border border-line px-3 py-2 text-sm">
            <i class="pi pi-link text-brand" />
            <span class="flex-1">{{ m.display }}</span>
            <span class="text-xs text-ink-3">{{ m.catalogId }}</span>
          </li>
        </ul>
      </TabPanel>
    </TabPanels>
  </Tabs>
</template>
