<script setup lang="ts">
// Справочник: элементы (поиск, иерархия, таблица с шифрами, карточка), структура, привязки классификаторов,
// согласование. Вкладки настройки видны только с правом configure. Логика — в stores и composables.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Tree from 'primevue/tree'
import type { TreeNode } from 'primevue/treenode'
import { useConfirm } from 'primevue/useconfirm'
import CatalogStructure from '@/components/catalog/CatalogStructure.vue'
import ClassifierBindings from '@/components/catalog/ClassifierBindings.vue'
import ElementCodes from '@/components/catalog/ElementCodes.vue'
import ElementIntegrations from '@/components/catalog/ElementIntegrations.vue'
import CodeAssignDialog from '@/components/classifier/CodeAssignDialog.vue'
import DynamicForm from '@/components/dynamic/DynamicForm.vue'
import DynamicTable from '@/components/dynamic/DynamicTable.vue'
import HistoryDrawer from '@/components/common/HistoryDrawer.vue'
import MatchTabs from '@/components/common/MatchTabs.vue'
import SearchBar from '@/components/common/SearchBar.vue'
import WorkflowEditor from '@/components/common/WorkflowEditor.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiField from '@/components/ui/UiField.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import UiSaveBar from '@/components/ui/UiSaveBar.vue'
import { useCatalogConfig } from '@/composables/useCatalogConfig'
import { useDynamicTable } from '@/composables/useDynamicTable'
import { useElementEditor } from '@/composables/useElementEditor'
import type { ReconcileResult } from '@/api/catalog'
import { useAuthStore } from '@/stores/auth'
import { formatAttribute, textOf } from '@/lib/attributes'
import { csvName, downloadText, toCsv } from '@/lib/csv'
import { useCatalogStore } from '@/stores/catalog'
import type { CatalogElement, ClassifierBinding } from '@/types'

const props = defineProps<{ id: string }>()

const route = useRoute()
const router = useRouter()
const store = useCatalogStore()
const auth = useAuthStore()
const table = useDynamicTable()
const editor = useElementEditor()
const confirm = useConfirm()
const config = useCatalogConfig(
  () => store.summaries.map((s) => s.id),
  () => Object.keys(store.classifiers),
)

const canConfigure = computed(() => auth.can('catalog', props.id, 'configure'))

/** Вкладка — в query, чтобы на неё можно было дать ссылку */
const tab = computed({
  get: () => (typeof route.query['tab'] === 'string' && canConfigure.value ? route.query['tab'] : 'elements'),
  set: (v: string) => void router.replace({ query: { ...route.query, tab: v === 'elements' ? undefined : v } }),
})

onMounted(async () => {
  await store.open(props.id)
  void store.loadList()
  // Конфиги классификаторов: для колонок шифров и (при настройке) для привязок
  await store.loadClassifiers(canConfigure.value ? undefined : store.currentCatalog?.classifierBindings.map((b) => b.classifierId))
})

const bindings = computed(() => store.currentCatalog?.classifierBindings ?? [])
const classifierName = (id: string) => store.classifiers[id]?.name ?? id
const codeColumns = computed(() => bindings.value.map((b) => ({ classifierId: b.classifierId, title: `Шифр: ${classifierName(b.classifierId)}`, required: b.required })))

const groupNodes = computed<TreeNode[]>(() => store.groupTree)
const selectedGroup = computed<Record<string, boolean>>(() => (store.currentParentId ? { [store.currentParentId]: true } : {}))

/* ------------------------------ карточка ------------------------------ */

const historyVisible = ref(false)
const reconcileResults = ref<ReconcileResult[]>([])
const cardTab = ref('attrs')

function openElement(el: CatalogElement): void {
  reconcileResults.value = []
  cardTab.value = 'attrs'
  editor.openExisting(el)
}

async function runReconcile(): Promise<void> {
  if (editor.editing.value) reconcileResults.value = await store.reconcile(editor.editing.value.id)
}

function askDelete(): void {
  const el = editor.editing.value
  if (!el) return
  confirm.require({
    header: 'Удалить элемент?',
    message: 'Действие нельзя отменить.',
    acceptProps: { label: 'Удалить', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: () => void store.removeElement(el.id).then(() => (editor.visible.value = false)),
  })
}

/* ------------------------------ шифры ------------------------------ */

const assignVisible = ref(false)
const assignBinding = ref<ClassifierBinding | null>(null)

function openAssign(b: ClassifierBinding): void {
  assignBinding.value = b
  assignVisible.value = true
}

/** После присвоения карточка показывает обновлённый элемент (наименование могло смениться) */
function onAssigned(el: CatalogElement): void {
  const fresh = store.accessibleElements.find((x) => x.id === el.id) ?? el
  editor.editing.value = fresh
  editor.form.reset(fresh.attributes)
}

/** После обмена у элемента обновились внешние идентификаторы */
async function onExchanged(): Promise<void> {
  const el = editor.editing.value
  if (!el) return
  const fresh = await store.refresh(el.id)
  if (fresh) editor.editing.value = fresh
}

function askRemoveCode(classifierId: string): void {
  const el = editor.editing.value
  if (!el) return
  confirm.require({
    header: 'Снять шифр?',
    message: `Шифр «${classifierName(classifierId)}» будет удалён у элемента.`,
    acceptProps: { label: 'Снять', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: () =>
      void store.removeCode(el.id, classifierId).then(() => {
        const fresh = store.accessibleElements.find((x) => x.id === el.id)
        if (fresh) editor.editing.value = fresh
      }),
  })
}

/* --------------------------- удаление справочника --------------------------- */

function askDeleteCatalog(): void {
  confirm.require({
    header: `Удалить справочник «${store.currentCatalog?.name ?? ''}»?`,
    message: 'Будут удалены все элементы и настройки согласования. Действие нельзя отменить.',
    acceptProps: { label: 'Удалить справочник', severity: 'danger' },
    rejectProps: { label: 'Отмена', severity: 'secondary', outlined: true },
    accept: () =>
      void store.removeCatalog(props.id).then((ok) => {
        if (ok) void router.push('/catalogs')
      }),
  })
}

const catalogAttrOptions = computed(() => (store.currentCatalog?.attributes ?? []).map((a) => ({ id: a.id, name: a.name })))
/** Выгрузка того, что видно: строки после поиска и группы, колонки после RBAC, плюс шифры */
function exportCsv(): void {
  const states = store.currentCatalog?.states ?? []
  const rows = table.rows.value.filter((e) => !e.isGroup)
  const csv = toCsv(rows, [
    ...table.columns.value.map((a) => ({ title: a.name, value: (e: CatalogElement) => formatAttribute(a, e.attributes[a.id]) })),
    ...codeColumns.value.map((c) => ({
      title: c.title,
      value: (e: CatalogElement) => e.codes?.find((x) => x.classifierId === c.classifierId && x.status === 'approved')?.code ?? '',
    })),
    { title: 'Состояние', value: (e: CatalogElement) => states.find((s) => s.id === e.state)?.name ?? e.state },
  ])
  downloadText(csvName(store.currentCatalog?.name ?? 'Справочник'), csv)
}

/** Группы справочника с путём («Стандартные изделия / Крепёж») — условия строк обходного листа */
const groupFilterOptions = computed(() => {
  const all = store.accessibleElements.filter((e) => e.isGroup)
  const path = (id: string | undefined): string => {
    const g = all.find((x) => x.id === id)
    return g ? [path(g.parentId), textOf(g.attributes['name'], g.id)].filter(Boolean).join(' / ') : ''
  }
  return all.map((g) => ({ id: g.id, name: path(g.id) })).sort((a, b) => a.name.localeCompare(b.name, 'ru'))
})
const boundClassifierOptions = computed(() => bindings.value.map((b) => ({ id: b.classifierId, name: classifierName(b.classifierId) })))
const codeAttrOptions = [
  { id: 'code', name: 'Шифр' },
  { id: 'decoded', name: 'Расшифровка' },
  { id: 'shortName', name: 'Краткое наименование' },
]
</script>

<template>
  <div class="flex flex-col">
    <UiPageHeader :title="store.currentCatalog?.name ?? 'Справочник'" :subtitle="store.currentCatalog?.description">
      <template #actions>
        <template v-if="tab === 'elements'">
          <Button v-if="editor.canCreate.value && table.hierarchical.value" label="Группа" icon="pi pi-folder-plus" severity="secondary" outlined @click="editor.openNew(true)" />
          <Button v-if="editor.canCreate.value" label="Добавить элемент" icon="pi pi-plus" data-testid="element-add" @click="editor.openNew()" />
        </template>
      </template>
    </UiPageHeader>

    <Tabs v-model:value="tab">
      <TabList>
        <Tab value="elements">Элементы</Tab>
        <Tab v-if="canConfigure" value="structure">Структура</Tab>
        <Tab v-if="canConfigure" value="classifiers">Классификаторы</Tab>
        <Tab v-if="canConfigure" value="workflow">Согласование</Tab>
      </TabList>
      <TabPanels class="!px-0">
        <!-- ЭЛЕМЕНТЫ -->
        <TabPanel value="elements">
          <SearchBar class="mb-4" :query="store.query" :mode="store.searchMode" @search="store.setSearch" />

          <nav v-if="table.hierarchical.value" class="mb-3 flex flex-wrap items-center gap-1.5 text-sm text-ink-3">
            <button type="button" class="hover:text-brand" :class="!store.currentParentId ? 'font-semibold text-brand-dark' : ''" @click="store.setParent(null)">
              Все группы
            </button>
            <template v-for="b in store.breadcrumbs" :key="b.id">
              <span class="text-line-strong">/</span>
              <button type="button" class="hover:text-brand" @click="store.setParent(b.id)">{{ b.label }}</button>
            </template>
          </nav>

          <!-- Фиксированная высота области — нужна виртуальному скроллеру таблицы -->
          <div class="flex h-[calc(100vh-19rem)] min-h-[440px] gap-4">
            <UiCard v-if="table.hierarchical.value" title="Группы" class="hidden w-60 shrink-0 overflow-auto lg:block">
              <Tree
                :value="groupNodes"
                selection-mode="single"
                :selection-keys="selectedGroup"
                class="!p-0 text-sm"
                @node-select="(n: TreeNode) => store.setParent(String(n.key))"
              />
            </UiCard>
            <div class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-line bg-white">
              <div class="flex items-center justify-between border-b border-line px-4 py-2.5 text-xs text-ink-3">
                <span>
                  Показано <b class="text-brand-dark">{{ table.rows.value.length.toLocaleString('ru-RU') }}</b> из
                  {{ table.total.value.toLocaleString('ru-RU') }}
                </span>
                <span class="flex items-center gap-3">
                  Колонок доступно: {{ table.columns.value.length }}
                  <Button
                    v-tooltip.top="'Выгрузить видимые строки в CSV (Excel)'"
                    label="CSV"
                    icon="pi pi-download"
                    size="small"
                    text
                    :disabled="table.rows.value.length === 0"
                    data-testid="catalog-export"
                    @click="exportCsv"
                  />
                </span>
              </div>
              <div class="min-h-0 flex-1">
                <DynamicTable
                  :columns="table.columns.value"
                  :rows="table.rows.value"
                  :states="table.states.value"
                  :loading="table.loading.value"
                  :virtual-scroller-options="table.virtualScrollerOptions"
                  :code-columns="codeColumns"
                  @open="openElement"
                  @enter-group="(g) => store.setParent(g.id)"
                />
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- СТРУКТУРА -->
        <TabPanel v-if="canConfigure" value="structure">
          <CatalogStructure :config="config" :catalogs="store.summaries" />
          <UiCard title="Удаление справочника" class="mt-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-ink-2">Справочник удаляется вместе с элементами. Нельзя удалить справочник, на который ссылаются другие.</p>
              <Button label="Удалить справочник" severity="danger" outlined size="small" @click="askDeleteCatalog" />
            </div>
          </UiCard>
        </TabPanel>

        <!-- КЛАССИФИКАТОРЫ -->
        <TabPanel v-if="canConfigure" value="classifiers">
          <ClassifierBindings :config="config" :classifiers="Object.values(store.classifiers)" />
        </TabPanel>

        <!-- СОГЛАСОВАНИЕ -->
        <TabPanel v-if="canConfigure" value="workflow">
          <div class="flex flex-col gap-5">
            <WorkflowEditor
              target-type="catalog-element"
              :target-id="props.id"
              title="Пополнение"
              description="Заявка пользователя на новый элемент. Модераторы шифруют его своими классификаторами, модератор справочника проверяет. Элемент появится, когда пройдены все строки."
              :attribute-options="catalogAttrOptions"
              :classifier-options="boundClassifierOptions"
              :group-options="groupFilterOptions"
            />
            <WorkflowEditor
              target-type="element-edit"
              :target-id="props.id"
              title="Корректировка"
              description="Проверка правок существующего элемента. Без строк правки применяются сразу; если пользователь отметил «шифр требует изменения», добавляются строки перешифровки из листа пополнения."
              :attribute-options="catalogAttrOptions"
            />
            <WorkflowEditor
              target-type="element-code"
              :target-id="props.id"
              title="Шифр из карточки элемента"
              description="Согласование шифра, который модератор присваивает прямо в карточке элемента. Без строк шифр утверждается сразу."
              :attribute-options="codeAttrOptions"
            />
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- Одна плашка сохранения на обе вкладки структуры: черновик общий -->
    <UiSaveBar
      v-if="tab === 'structure' || tab === 'classifiers'"
      :dirty="config.dirty.value"
      :saving="config.saving.value"
      :issues="config.issues.value"
      @save="config.save"
      @discard="config.discard"
    />

    <!-- Карточка элемента -->
    <Dialog
      v-model:visible="editor.visible.value"
      modal
      :header="editor.editing.value ? 'Элемент справочника' : editor.isGroup.value ? 'Новая группа' : 'Новый элемент'"
      class="w-full max-w-4xl"
      :draggable="false"
    >
      <Tabs v-model:value="cardTab">
        <TabList>
          <Tab value="attrs">Атрибуты</Tab>
          <Tab v-if="editor.editing.value && !editor.isGroup.value && bindings.length" value="codes" data-testid="tab-codes">
            Шифры
            <span class="ml-1 text-xs text-ink-3">{{ editor.editing.value.codes?.length ?? 0 }}/{{ bindings.length }}</span>
          </Tab>
          <Tab v-if="editor.editing.value && !editor.isGroup.value" value="integrations" data-testid="tab-integrations">Интеграции</Tab>
          <Tab v-if="editor.editing.value?.matches?.length" value="matches">Сопоставления</Tab>
        </TabList>
        <TabPanels class="!px-0">
          <TabPanel value="attrs">
            <div class="flex flex-col gap-5">
              <DynamicForm
                :attributes="editor.attributes.value"
                :model-value="editor.form.model.value"
                :errors="editor.form.errors.value"
                :readonly="editor.readonly.value"
                @field="editor.form.setField"
              />
              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <UiField label="Состояние" for-id="el-state">
                  <Select
                    v-model="editor.state.value"
                    input-id="el-state"
                    :options="store.currentCatalog?.states ?? []"
                    option-label="name"
                    option-value="id"
                    :disabled="editor.readonly.value"
                    fluid
                  />
                </UiField>
                <UiField v-if="table.hierarchical.value" label="Группа" for-id="el-parent">
                  <Select
                    v-model="editor.parentId.value"
                    input-id="el-parent"
                    :options="editor.groupOptions.value"
                    option-label="label"
                    option-value="id"
                    show-clear
                    placeholder="Корень"
                    :disabled="editor.readonly.value"
                    fluid
                  />
                </UiField>
              </div>
              <UiCard v-if="reconcileResults.length" title="Сверка с внешними базами НСИ">
                <ul class="flex flex-col gap-1 text-sm">
                  <li v-for="r in reconcileResults" :key="r.source" class="flex items-center gap-2">
                    <i :class="r.found ? 'pi pi-check-circle text-emerald-600' : 'pi pi-times-circle text-ink-3'" />
                    <b class="w-40">{{ r.source }}</b>
                    <span class="flex-1 truncate">{{ r.externalName ?? 'не найдено' }}</span>
                    <span v-if="r.similarity !== undefined" class="text-xs text-ink-3">{{ Math.round(r.similarity * 100) }}%</span>
                  </li>
                </ul>
              </UiCard>
            </div>
          </TabPanel>
          <TabPanel v-if="editor.editing.value" value="codes">
            <ElementCodes
              :element="editor.editing.value"
              :bindings="bindings"
              :classifier-name="classifierName"
              :can-edit="!editor.readonly.value"
              @assign="openAssign"
              @remove="askRemoveCode"
            />
          </TabPanel>
          <TabPanel v-if="editor.editing.value && !editor.isGroup.value" value="integrations">
            <ElementIntegrations :element="editor.editing.value" :can-export="!editor.readonly.value" @changed="onExchanged" />
          </TabPanel>
          <TabPanel v-if="editor.editing.value?.matches?.length" value="matches">
            <MatchTabs :matches="editor.editing.value.matches" />
          </TabPanel>
        </TabPanels>
      </Tabs>
      <template #footer>
        <div class="flex w-full flex-wrap justify-between gap-2">
          <div class="flex gap-1">
            <Button v-if="editor.editing.value" label="История" icon="pi pi-history" text size="small" @click="historyVisible = true" />
            <Button v-if="editor.editing.value" label="Сверка" icon="pi pi-verified" text size="small" @click="runReconcile" />
            <Button v-if="editor.editing.value && editor.canDelete.value" label="Удалить" icon="pi pi-trash" severity="danger" text size="small" @click="askDelete" />
          </div>
          <div class="flex gap-2">
            <Button label="Закрыть" severity="secondary" text @click="editor.visible.value = false" />
            <Button v-if="!editor.readonly.value && cardTab === 'attrs'" label="Сохранить" icon="pi pi-check" :loading="editor.saving.value" data-testid="element-save" @click="editor.save" />
          </div>
        </div>
      </template>
    </Dialog>

    <CodeAssignDialog v-model:visible="assignVisible" :element="editor.editing.value" :binding="assignBinding" @assigned="onAssigned" />

    <HistoryDrawer
      v-model:visible="historyVisible"
      :element="editor.editing.value"
      :attributes="store.visibleAttributes"
      :states="store.currentCatalog?.states ?? []"
    />
  </div>
</template>
