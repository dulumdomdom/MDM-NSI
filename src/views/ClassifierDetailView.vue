<script setup lang="ts">
// Классификатор. «Ввод шифра»: сверху поле шифра (direct), ниже — список фасетов (wizard), синхронно через store.
// Вкладки настройки (право configure): свойства и фасеты, структура, расшифровка, согласование —
// общий черновик useClassifierConfig и одна плашка сохранения.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import { useConfirm } from 'primevue/useconfirm'
import ClassifierGeneral from '@/components/classifier/ClassifierGeneral.vue'
import CodeInput from '@/components/classifier/CodeInput.vue'
import DecodeEditor from '@/components/classifier/DecodeEditor.vue'
import DecodePanel from '@/components/classifier/DecodePanel.vue'
import FacetList from '@/components/classifier/FacetList.vue'
import FacetTree from '@/components/classifier/FacetTree.vue'
import FacetWizard from '@/components/classifier/FacetWizard.vue'
import StructureEditor from '@/components/classifier/StructureEditor.vue'
import WorkflowEditor from '@/components/common/WorkflowEditor.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import UiSaveBar from '@/components/ui/UiSaveBar.vue'
import { useClassifierConfig } from '@/composables/useClassifierConfig'
import { useAuthStore } from '@/stores/auth'
import { duplicateMessage, useClassifierStore, type SubmitResult } from '@/stores/classifier'
import { useUiStore } from '@/stores/ui'

const props = defineProps<{ id: string }>()

const route = useRoute()
const router = useRouter()
const store = useClassifierStore()
const auth = useAuthStore()
const ui = useUiStore()
const confirm = useConfirm()
const config = useClassifierConfig()

const lastResult = ref<SubmitResult | null>(null)

onMounted(() => void store.load(props.id))

const canConfigure = computed(() => auth.can('classifier', props.id, 'configure'))
const canCreate = computed(() => auth.can('classifier', props.id, 'create'))
const directEnabled = computed(() => store.availableModes.includes('direct'))
const wizardEnabled = computed(() => store.availableModes.includes('wizard'))
const hasFacets = computed(() => (store.classifier?.facets.length ?? 0) > 0)

const tab = computed({
  get: () => (typeof route.query['tab'] === 'string' && canConfigure.value ? route.query['tab'] : 'input'),
  set: (v: string) => void router.replace({ query: { ...route.query, tab: v === 'input' ? undefined : v } }),
})
const isConfigTab = computed(() => tab.value !== 'input' && tab.value !== 'workflow')

async function save(): Promise<void> {
  const res = await store.submit()
  lastResult.value = res
  if (res.ok) {
    ui.notify('success', 'Заявка создана', `${res.request.title} (№ ${res.request.id})`)
    store.reset()
  }
}

const duplicateText = computed(() => {
  const r = lastResult.value
  return r && !r.ok && r.reason === 'duplicate' ? duplicateMessage(r.duplicate) : ''
})

function askDelete(): void {
  confirm.require({
    header: `Удалить классификатор «${store.classifier?.name ?? ''}»?`,
    message: 'Удалятся конфигурация и утверждённые записи. Классификатор, привязанный к справочникам, удалить нельзя.',
    acceptProps: { label: 'Удалить', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: () =>
      void store.remove(props.id).then((ok) => {
        if (ok) void router.push('/classifiers')
      }),
  })
}

const entryAttrOptions = [
  { id: 'code', name: 'Шифр' },
  { id: 'decoded', name: 'Расшифровка' },
  { id: 'shortName', name: 'Краткое наименование' },
]
</script>

<template>
  <div>
    <UiPageHeader :title="store.classifier?.name ?? 'Классификатор'" :subtitle="store.classifier?.description">
      <template #actions>
        <template v-if="tab === 'input'">
          <Button label="Очистить" severity="secondary" text @click="store.reset" />
          <Button
            v-if="canCreate"
            label="Записать"
            icon="pi pi-check"
            :disabled="!store.canSubmit"
            :loading="store.saving"
            data-testid="save-entry"
            @click="save"
          />
        </template>
      </template>
    </UiPageHeader>

    <Tabs v-if="store.classifier" v-model:value="tab">
      <TabList>
        <Tab value="input">Ввод шифра</Tab>
        <Tab v-if="canConfigure" value="settings">Свойства и фасеты</Tab>
        <Tab v-if="canConfigure" value="structure">Структура</Tab>
        <Tab v-if="canConfigure" value="decode">Расшифровка</Tab>
        <Tab v-if="canConfigure" value="workflow">Согласование</Tab>
      </TabList>
      <TabPanels class="!px-0 !pt-0">
        <!-- ВВОД -->
        <TabPanel value="input">
          <UiEmpty v-if="!hasFacets" text="У классификатора ещё нет фасетов">
            <Button v-if="canConfigure" label="Настроить фасеты" size="small" outlined @click="tab = 'settings'" />
          </UiEmpty>
          <template v-else>
            <!-- Шифр: закреплён сверху, пока заполняются фасеты -->
            <div class="sticky top-0 z-10 -mx-8 border-b border-line bg-white px-8 pb-4 pt-4">
              <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
                <label for="code-input" class="text-sm font-bold text-brand-dark">Шифр</label>
                <Select
                  :model-value="store.catalogId"
                  :options="store.catalogs"
                  option-label="name"
                  option-value="id"
                  aria-label="Каталог"
                  class="w-60"
                  size="small"
                  data-testid="catalog-select"
                  @update:model-value="(v: string) => store.selectCatalog(v)"
                />
              </div>
              <CodeInput :editable="directEnabled" />
              <Message v-if="duplicateText" severity="warn" :closable="false" class="mt-3" data-testid="duplicate-message">{{ duplicateText }}</Message>
            </div>

            <div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_340px]">
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 class="text-sm font-bold text-brand-dark">{{ wizardEnabled ? 'Фасеты' : 'Разбор шифра' }}</h2>
                  <span v-if="wizardEnabled" class="text-2xs text-ink-3">
                    <kbd class="kbd">←</kbd><kbd class="kbd">→</kbd> по значениям · набор кода — выбор · <kbd class="kbd">Enter</kbd> следующий фасет
                  </span>
                </div>
                <FacetWizard :readonly="!wizardEnabled" />
              </div>
              <div class="flex flex-col gap-4 xl:sticky xl:top-[178px] xl:self-start">
                <DecodePanel />
                <details class="group rounded-lg border border-line bg-white">
                  <summary class="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-bold text-brand-dark">
                    Ветка структуры
                    <i class="pi pi-chevron-down text-xs text-ink-3 transition-transform group-open:rotate-180" />
                  </summary>
                  <div class="border-t border-line p-3"><FacetTree /></div>
                </details>
              </div>
            </div>
          </template>
        </TabPanel>

        <!-- СВОЙСТВА И ФАСЕТЫ -->
        <TabPanel v-if="canConfigure" value="settings">
          <div class="flex flex-col gap-5 pt-5">
            <ClassifierGeneral :config="config" />
            <FacetList :config="config" />
            <UiCard title="Удаление классификатора">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-sm text-ink-2">Нельзя удалить классификатор, привязанный к справочникам.</p>
                <Button label="Удалить классификатор" severity="danger" outlined size="small" @click="askDelete" />
              </div>
            </UiCard>
          </div>
        </TabPanel>

        <!-- СТРУКТУРА -->
        <TabPanel v-if="canConfigure" value="structure">
          <div class="pt-5"><StructureEditor :config="config" /></div>
        </TabPanel>

        <!-- РАСШИФРОВКА -->
        <TabPanel v-if="canConfigure" value="decode">
          <div class="pt-5"><DecodeEditor :config="config" /></div>
        </TabPanel>

        <!-- СОГЛАСОВАНИЕ -->
        <TabPanel v-if="canConfigure" value="workflow">
          <div class="pt-5">
            <WorkflowEditor
              target-type="classifier-entry"
              :target-id="props.id"
              title="Новые записи классификатора"
              description="Кто согласует новый шифр, прежде чем он попадёт в классификатор."
              :attribute-options="entryAttrOptions"
            />
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <UiSaveBar
      v-if="isConfigTab"
      :dirty="config.dirty.value"
      :saving="config.saving.value"
      :issues="config.issues.value"
      @save="config.save"
      @discard="config.discard"
    />
  </div>
</template>
