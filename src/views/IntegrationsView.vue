<script setup lang="ts">
// Интеграции: три внешние системы предприятия (АСУ, 1С, Imbase), потоки обмена и журнал.
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import ToggleSwitch from 'primevue/toggleswitch'
import FlowDialog from '@/components/integration/FlowDialog.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { describeTrigger } from '@/lib/integration'
import { useCatalogStore } from '@/stores/catalog'
import { useIntegrationStore } from '@/stores/integration'
import type { ExchangeRecord, ExchangeStatus, ExchangeTrigger, IntegrationFlow, IntegrationProtocol } from '@/types'

const store = useIntegrationStore()
const catalogStore = useCatalogStore()
onMounted(async () => {
  await store.load()
  await catalogStore.loadClassifiers()
})

const dt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmt = (iso?: string) => (iso ? dt.format(new Date(iso)) : '—')

const PROTOCOL: Record<IntegrationProtocol, string> = {
  rest: 'REST',
  soap: 'SOAP',
  '1c-bus': 'HTTP-сервис 1С',
  com: 'COM',
  sql: 'Прямое подключение к БД',
  rabbitmq: 'RabbitMQ',
  kafka: 'Kafka',
  xml: 'Обмен XML-файлами',
  csv: 'Обмен CSV-файлами',
}
const STATUS: Record<ExchangeStatus, { label: string; cls: string }> = {
  success: { label: 'Успешно', cls: 'bg-emerald-50 text-emerald-700' },
  error: { label: 'Ошибка', cls: 'bg-red-50 text-red-700' },
  skipped: { label: 'Пропущено', cls: 'bg-canvas text-ink-3' },
}
const TRIGGER: Record<ExchangeTrigger, string> = { event: 'событие', schedule: 'расписание', manual: 'вручную' }

const classifierName = (id: string) => catalogStore.classifiers[id]?.name ?? id
const catalogName = (id: string) => store.catalogs[id]?.name ?? id

/* ------------------------------ журнал ------------------------------ */

const journalSystem = ref<string | null>(null)
const journalStatus = ref<ExchangeStatus | null>(null)
const statusOptions = (Object.keys(STATUS) as ExchangeStatus[]).map((s) => ({ value: s, label: STATUS[s].label }))
const filtered = ref<ExchangeRecord[] | null>(null)
watch([journalSystem, journalStatus, () => store.journal], async ([systemId, status]) => {
  filtered.value = systemId || status ? await store.queryJournal({ systemId: systemId ?? undefined, status: status ?? undefined }) : null
})
/** Без фильтров — общий журнал store (он же питает карточки систем) */
const journalRows = computed(() => filtered.value ?? store.journal)

/* ------------------------------ потоки ------------------------------ */

const flowVisible = ref(false)
const editingFlow = ref<IntegrationFlow | null>(null)
function openFlow(f: IntegrationFlow): void {
  editingFlow.value = f
  flowVisible.value = true
}
async function saveFlow(f: IntegrationFlow): Promise<void> {
  if (await store.saveFlow(f)) flowVisible.value = false
}
const isEnabled = (systemId: string) => store.systems.find((s) => s.id === systemId)?.enabled ?? false
</script>

<template>
  <div>
    <UiPageHeader title="Интеграции" subtitle="Обмен нормативно-справочной информацией с системами предприятия" />

    <!-- СИСТЕМЫ -->
    <div class="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <section
        v-for="s in store.systems"
        :key="s.id"
        class="flex flex-col rounded-lg border border-line bg-white"
        :class="s.enabled ? '' : 'opacity-70'"
        :data-testid="`system-${s.id}`"
      >
        <header class="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div class="min-w-0">
            <h2 class="text-base font-bold text-brand-dark">{{ s.name }}</h2>
            <p class="text-xs text-ink-3">{{ PROTOCOL[s.protocol] }}</p>
          </div>
          <ToggleSwitch v-tooltip.top="s.enabled ? 'Отключить обмен' : 'Включить обмен'" :model-value="s.enabled" :aria-label="`Обмен с ${s.name}`" @update:model-value="(v: boolean) => store.saveSystem({ ...s, enabled: v })" />
        </header>
        <div class="flex flex-1 flex-col gap-3 px-4 py-3">
          <p class="text-sm text-ink-2">{{ s.role }}</p>
          <p class="code-font truncate rounded bg-canvas px-2 py-1 text-xs text-ink-2" :title="s.endpoint">{{ s.endpoint }}</p>
          <dl class="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt class="text-ink-3">Потоков</dt>
              <dd class="text-sm font-semibold text-ink">{{ store.flowsOf(s.id).length }}</dd>
            </div>
            <div>
              <dt class="text-ink-3">Последний обмен</dt>
              <dd class="text-sm font-semibold text-ink">{{ fmt(store.lastExchange(s.id)) }}</dd>
            </div>
            <div>
              <dt class="text-ink-3">Ошибок</dt>
              <dd class="text-sm font-semibold" :class="store.errorsOf(s.id) ? 'text-red-600' : 'text-ink'">{{ store.errorsOf(s.id) }}</dd>
            </div>
          </dl>
        </div>
        <footer class="border-t border-line px-2 py-1.5">
          <Button label="Проверить связь" icon="pi pi-wifi" text size="small" @click="store.ping(s.id)" />
        </footer>
      </section>
    </div>

    <Tabs value="flows">
      <TabList>
        <Tab value="flows">Потоки обмена <span class="ml-1 text-xs text-ink-3">{{ store.flows.length }}</span></Tab>
        <Tab value="journal">Журнал</Tab>
      </TabList>
      <TabPanels class="!px-0">
        <!-- ПОТОКИ -->
        <TabPanel value="flows">
          <div class="overflow-hidden rounded-lg border border-line">
            <div class="grid grid-cols-[1.4fr_1fr_1.1fr_110px_60px_200px] gap-4 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
              <span>Поток</span><span>Справочник</span><span>Запуск</span><span>Последний</span><span>Вкл.</span><span />
            </div>
            <UiEmpty v-if="store.flows.length === 0" :text="store.loading ? 'Загрузка…' : 'Потоков нет'" />
            <div
              v-for="f in store.flows"
              :key="f.id"
              class="grid grid-cols-[1.4fr_1fr_1.1fr_110px_60px_200px] items-center gap-4 border-b border-line px-4 py-3 last:border-b-0"
              :data-testid="`flow-${f.id}`"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-sm font-semibold text-ink">
                  <i class="pi text-xs" :class="f.direction === 'export' ? 'pi-upload text-brand' : 'pi-download text-emerald-600'" />
                  <span class="truncate">{{ f.name }}</span>
                </div>
                <div class="text-xs text-ink-3">
                  {{ store.systemName(f.systemId) }} ·
                  <template v-if="f.direction === 'import'">{{ f.importMode === 'request' ? 'через заявку' : 'сразу в справочник' }}</template>
                  <template v-else>{{ f.mapping.length }} полей</template>
                </div>
              </div>
              <span class="truncate text-sm text-ink-2">{{ catalogName(f.catalogId) }}</span>
              <span class="text-sm text-ink-2">{{ describeTrigger(f.trigger) }}</span>
              <span class="text-sm text-ink-2">{{ fmt(f.lastRunAt) }}</span>
              <ToggleSwitch :model-value="f.enabled" :aria-label="`Поток ${f.name}`" @update:model-value="(v: boolean) => store.saveFlow({ ...f, enabled: v })" />
              <div class="flex justify-end gap-1">
                <Button
                  label="Запустить"
                  icon="pi pi-play"
                  size="small"
                  outlined
                  :loading="store.running === f.id"
                  :disabled="!f.enabled || !isEnabled(f.systemId) || store.running !== null"
                  :data-testid="`run-${f.id}`"
                  @click="store.run(f.id)"
                />
                <Button v-tooltip.top="'Настроить'" icon="pi pi-cog" text rounded size="small" severity="secondary" :data-testid="`edit-${f.id}`" @click="openFlow(f)" />
              </div>
            </div>
          </div>
          <p class="mt-3 max-w-3xl text-xs text-ink-3">
            Выгрузка «при изменении» уходит сразу после сохранения элемента или утверждения шифра. Импорт новых стандартных изделий из Imbase
            проходит обходной лист, как пополнение от пользователя; контрагенты из 1С поступают сразу — 1С для них мастер-система.
          </p>
        </TabPanel>

        <!-- ЖУРНАЛ -->
        <TabPanel value="journal">
          <div class="mb-4 flex flex-wrap gap-3">
            <Select v-model="journalSystem" :options="store.systems" option-label="name" option-value="id" placeholder="Все системы" show-clear class="w-56" aria-label="Система" />
            <Select v-model="journalStatus" :options="statusOptions" option-label="label" option-value="value" placeholder="Любой статус" show-clear class="w-48" aria-label="Статус" />
          </div>
          <div class="overflow-hidden rounded-lg border border-line" data-testid="journal">
            <div class="grid grid-cols-[110px_1fr_1.6fr_110px_110px] gap-4 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
              <span>Время</span><span>Поток</span><span>Что передано</span><span>Запуск</span><span>Статус</span>
            </div>
            <UiEmpty v-if="journalRows.length === 0" text="Записей нет" />
            <div v-for="r in journalRows" :key="r.id" class="grid grid-cols-[110px_1fr_1.6fr_110px_110px] items-start gap-4 border-b border-line px-4 py-2.5 text-sm last:border-b-0">
              <span class="text-ink-2">{{ fmt(r.at) }}</span>
              <div class="min-w-0">
                <div class="truncate text-ink">{{ store.flows.find((f) => f.id === r.flowId)?.name ?? r.flowId }}</div>
                <div class="text-xs text-ink-3">{{ store.systemName(r.systemId) }}</div>
              </div>
              <div class="min-w-0">
                <div v-if="r.elementName" class="truncate text-ink">
                  {{ r.elementName }}<span v-if="r.externalId" class="code-font ml-2 text-xs text-ink-3">{{ r.externalId }}</span>
                </div>
                <div class="text-xs" :class="r.status === 'error' ? 'text-red-600' : 'text-ink-3'">{{ r.message }}</div>
              </div>
              <span class="text-ink-2">{{ TRIGGER[r.trigger] }}</span>
              <span><span class="rounded px-2 py-0.5 text-xs font-semibold" :class="STATUS[r.status].cls">{{ STATUS[r.status].label }}</span></span>
            </div>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <FlowDialog
      v-model:visible="flowVisible"
      :flow="editingFlow"
      :catalog="editingFlow ? (store.catalogs[editingFlow.catalogId] ?? null) : null"
      :system-name="editingFlow ? store.systemName(editingFlow.systemId) : ''"
      :classifier-name="classifierName"
      @save="saveFlow"
    />
  </div>
</template>
