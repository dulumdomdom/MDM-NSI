<script setup lang="ts">
// Элемент во внешних системах: идентификаторы в АСУ / 1С / Imbase, состояние передачи, история обмена.
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import { checkExport } from '@/lib/integration'
import { useIntegrationStore } from '@/stores/integration'
import type { CatalogElement, ExchangeRecord } from '@/types'

const props = defineProps<{ element: CatalogElement; canExport: boolean }>()
const emit = defineEmits<{ changed: [] }>()

const store = useIntegrationStore()
const history = ref<ExchangeRecord[]>([])

const dt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmt = (iso: string) => dt.format(new Date(iso))

async function loadHistory(): Promise<void> {
  history.value = await store.queryJournal({ elementId: props.element.id })
}
onMounted(async () => {
  await store.loadMeta()
  await loadHistory()
})
watch(() => props.element.id, () => void loadHistory())

/** По каждой системе: ссылка на запись и поток выгрузки этого справочника */
const rows = computed(() =>
  store.systems.map((s) => {
    const flow = store.flows.find((f) => f.systemId === s.id && f.catalogId === props.element.catalogId && f.direction === 'export')
    const check = flow ? checkExport(flow, props.element) : null
    return { system: s, ref: props.element.externalRefs?.find((r) => r.systemId === s.id), flow, check }
  }),
)

async function exportNow(flowId: string): Promise<void> {
  await store.run(flowId, props.element.id)
  await loadHistory()
  emit('changed')
}
</script>

<template>
  <div>
    <div v-for="r in rows" :key="r.system.id" class="flex flex-wrap items-start justify-between gap-3 border-b border-line py-3.5 last:border-b-0" :data-testid="`ext-${r.system.id}`">
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold text-ink">{{ r.system.name }}</div>
        <template v-if="r.ref?.externalId">
          <div class="mt-1 text-xs text-ink-3">{{ r.system.idLabel }}</div>
          <div class="code-font text-lg font-semibold tracking-wide text-brand-dark">{{ r.ref.externalId }}</div>
        </template>
        <div v-else class="mt-1 text-sm text-ink-3">
          <template v-if="!r.flow">Справочник в эту систему не передаётся</template>
          <template v-else-if="r.check && !r.check.eligible">Не передаётся: {{ r.check.reason }}</template>
          <template v-else>Ещё не передан</template>
        </div>
        <div v-if="r.ref?.status === 'error'" class="mt-1 text-sm text-red-600">{{ r.ref.message }}</div>
        <div v-else-if="r.ref" class="mt-0.5 text-xs text-ink-3">Синхронизирован {{ fmt(r.ref.syncedAt) }}</div>
      </div>
      <div class="flex items-center gap-2">
        <span v-if="r.ref" class="rounded px-2 py-0.5 text-xs font-semibold" :class="r.ref.status === 'synced' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'">
          {{ r.ref.status === 'synced' ? 'Синхронизирован' : 'Ошибка' }}
        </span>
        <Button
          v-if="props.canExport && r.flow"
          label="Выгрузить сейчас"
          icon="pi pi-upload"
          size="small"
          outlined
          :loading="store.running === r.flow.id"
          :disabled="!r.system.enabled || !r.flow.enabled || !r.check?.eligible || store.running !== null"
          :data-testid="`export-${r.system.id}`"
          @click="exportNow(r.flow.id)"
        />
      </div>
    </div>

    <h3 class="mb-2 mt-5 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">История обмена</h3>
    <UiEmpty v-if="history.length === 0" text="Обменов по элементу не было" />
    <ul v-else class="flex flex-col gap-1.5 text-sm">
      <li v-for="h in history.slice(0, 10)" :key="h.id" class="flex items-baseline gap-3">
        <span class="w-24 shrink-0 text-xs text-ink-3">{{ fmt(h.at) }}</span>
        <i class="pi text-xs" :class="h.status === 'success' ? 'pi-check text-emerald-600' : h.status === 'error' ? 'pi-times text-red-600' : 'pi-minus text-ink-3'" />
        <span class="w-36 shrink-0 truncate font-medium text-ink">{{ store.systemName(h.systemId) }}</span>
        <span class="min-w-0 flex-1 truncate text-ink-2">{{ h.message }}</span>
      </li>
    </ul>
  </div>
</template>
