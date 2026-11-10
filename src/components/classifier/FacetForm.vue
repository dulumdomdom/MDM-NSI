<script setup lang="ts">
// Форма фасета: длина (фиксированная / до разделителя / остаток), тип, обязательность, значения и зависимости.
import { deepClone } from '@/lib/clone'
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tab from 'primevue/tab'
import TabList from 'primevue/tablist'
import TabPanel from 'primevue/tabpanel'
import TabPanels from 'primevue/tabpanels'
import Tabs from 'primevue/tabs'
import Textarea from 'primevue/textarea'
import DependencyEditor from './DependencyEditor.vue'
import UiField from '@/components/ui/UiField.vue'
import { optionsToText, parseOptionsText } from '@/composables/useClassifierConfig'
import { validateRules } from '@/lib/classifier'
import type { Classifier, FacetConfig, FacetDataType, FacetLengthMode } from '@/types'

const props = defineProps<{ facet: FacetConfig | null; classifier: Classifier }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [facet: FacetConfig] }>()

const form = ref<FacetConfig | null>(null)
const optionsText = ref('')
const tab = ref('main')

watch(
  () => [visible.value, props.facet] as const,
  ([v, f]) => {
    if (!v || !f) return
    form.value = deepClone(f)
    optionsText.value = optionsToText(f.options)
    tab.value = 'main'
  },
  { immediate: true },
)

const LENGTH_MODES: { value: FacetLengthMode; label: string }[] = [
  { value: 'fixed', label: 'Фиксированная' },
  { value: 'delimiter', label: 'До разделителя' },
  { value: 'remainder', label: 'Остаток шифра' },
]
const DATA_TYPES: { value: FacetDataType; label: string }[] = [
  { value: 'string', label: 'Строка' },
  { value: 'int', label: 'Целое' },
  { value: 'float', label: 'Дробное' },
  { value: 'bool', label: 'Да/нет' },
]

/** Проверка правил на копии классификатора с текущей формой */
const ruleIssues = computed(() =>
  form.value ? validateRules({ ...props.classifier, facets: props.classifier.facets.map((f) => (f.id === form.value?.id ? form.value : f)) }) : [],
)

/** Убрать поля, не относящиеся к выбранному режиму длины, и пустые */
function clean(f: FacetConfig): FacetConfig {
  const out: FacetConfig = {
    id: f.id,
    name: f.name.trim(),
    lengthMode: f.lengthMode,
    defaultLength: 1,
    dataType: f.dataType,
    required: f.required,
    section: f.section,
  }
  if (f.description?.trim()) out.description = f.description.trim()
  if (f.lengthMode === 'fixed') out.fixedLength = f.fixedLength ?? 1
  if (f.lengthMode === 'delimiter') out.delimiter = f.delimiter || '-'
  if (f.visible === false) out.visible = false
  if (f.placeholder?.trim()) out.placeholder = f.placeholder.trim()
  const options = parseOptionsText(optionsText.value)
  if (options.length) out.options = options
  if (f.dependencies?.length) out.dependencies = f.dependencies
  return out
}

function save(): void {
  if (!form.value?.name.trim()) return
  emit('save', clean(form.value))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="form ? `Фасет «${form.name}»` : 'Фасет'" class="w-full max-w-3xl" :draggable="false">
    <Tabs v-if="form" v-model:value="tab">
      <TabList>
        <Tab value="main">Параметры</Tab>
        <Tab value="options">Значения <span class="ml-1 text-xs text-ink-3">{{ parseOptionsText(optionsText).length || '' }}</span></Tab>
        <Tab value="deps">Зависимости <span class="ml-1 text-xs text-ink-3">{{ form.dependencies?.length || '' }}</span></Tab>
      </TabList>
      <TabPanels class="!px-0">
        <TabPanel value="main">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UiField label="Наименование" for-id="ff-name" required class="sm:col-span-2">
              <InputText id="ff-name" v-model="form.name" fluid />
            </UiField>
            <UiField label="Смысловой блок" for-id="ff-section">
              <Select v-model="form.section" input-id="ff-section" :options="props.classifier.sections" option-label="name" option-value="id" fluid />
            </UiField>
            <UiField label="Тип значения" for-id="ff-type">
              <Select v-model="form.dataType" input-id="ff-type" :options="DATA_TYPES" option-label="label" option-value="value" fluid />
            </UiField>
            <UiField label="Длина фасета в шифре" class="sm:col-span-2">
              <SelectButton v-model="form.lengthMode" :options="LENGTH_MODES" option-label="label" option-value="value" :allow-empty="false" />
            </UiField>
            <UiField v-if="form.lengthMode === 'fixed'" label="Символов" for-id="ff-len">
              <InputNumber v-model="form.fixedLength" input-id="ff-len" :min="1" :max="64" show-buttons fluid />
            </UiField>
            <UiField v-if="form.lengthMode === 'delimiter'" label="Символ окончания" for-id="ff-delim">
              <InputText id="ff-delim" v-model="form.delimiter" class="code-font" maxlength="3" fluid />
            </UiField>
            <p v-if="form.lengthMode === 'remainder'" class="text-sm text-ink-2 sm:col-span-2">
              Фасет забирает весь оставшийся шифр — он может быть только последним в ветке структуры.
            </p>
            <UiField label="Пример значения (подсказка)" for-id="ff-ph">
              <InputText id="ff-ph" v-model="form.placeholder" class="code-font" fluid />
            </UiField>
            <UiField label="Описание" for-id="ff-desc">
              <InputText id="ff-desc" v-model="form.description" fluid />
            </UiField>
            <label class="flex items-center gap-2 text-sm"><Checkbox v-model="form.required" binary />Обязательный</label>
            <label class="flex items-center gap-2 text-sm">
              <Checkbox :model-value="form.visible === false" binary @update:model-value="(v: boolean) => form && (form.visible = v ? false : undefined)" />
              Скрыт по умолчанию (показывается правилом)
            </label>
          </div>
        </TabPanel>
        <TabPanel value="options">
          <p class="mb-2 text-sm text-ink-2">Допустимые значения — по одному в строке: <span class="code-font">код = наименование</span>. Пусто — свободный ввод по типу.</p>
          <Textarea v-model="optionsText" rows="10" class="code-font w-full text-sm" placeholder="SV = Сверло&#10;FR = Фреза" />
        </TabPanel>
        <TabPanel value="deps">
          <DependencyEditor
            :facet="form"
            :facets="props.classifier.facets"
            :issues="ruleIssues"
            @update:rules="(rules) => form && (form.dependencies = rules)"
          />
        </TabPanel>
      </TabPanels>
    </Tabs>
    <template #footer>
      <Button label="Отмена" severity="secondary" text @click="visible = false" />
      <Button label="Применить" :disabled="!form?.name.trim()" @click="save" />
    </template>
  </Dialog>
</template>
