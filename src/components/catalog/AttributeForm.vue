<script setup lang="ts">
// Форма атрибута справочника: тип, обязательность, отображение, проверки по типу, цель ссылки.
import { deepClone } from '@/lib/clone'
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import UiField from '@/components/ui/UiField.vue'
import { ATTRIBUTE_TYPES } from '@/lib/catalogSchema'
import type { CatalogAttribute, CatalogSummary } from '@/types'

const props = defineProps<{ attribute: CatalogAttribute | null; catalogs: CatalogSummary[]; nested?: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [attr: CatalogAttribute] }>()

const form = ref<CatalogAttribute | null>(null)
watch(
  () => [visible.value, props.attribute] as const,
  ([v, a]) => {
    if (v && a) form.value = deepClone(a)
  },
  { immediate: true },
)

const isNumber = computed(() => form.value?.type === 'int' || form.value?.type === 'float')
// Составной внутри составного не поддерживаем в редакторе — достаточно одного уровня
const types = computed(() => (props.nested ? ATTRIBUTE_TYPES.filter((t) => t.type !== 'composite') : ATTRIBUTE_TYPES))

/** Пустые необязательные поля удаляем, чтобы конфиг оставался чистым */
function clean(a: CatalogAttribute): CatalogAttribute {
  const out: CatalogAttribute = { id: a.id, name: a.name.trim(), type: a.type, required: a.required }
  if (a.listed === false) out.listed = false
  if (a.width) out.width = a.width
  if (a.type === 'string') {
    if (a.maxLength) out.maxLength = a.maxLength
    if (a.pattern?.trim()) out.pattern = a.pattern.trim()
  }
  if (a.type === 'int' || a.type === 'float') {
    if (a.min !== undefined && a.min !== null) out.min = a.min
    if (a.max !== undefined && a.max !== null) out.max = a.max
  }
  if (a.type === 'reference') {
    if (a.referenceCatalogId) out.referenceCatalogId = a.referenceCatalogId
    if (a.referenceDisplayAttributeId?.trim()) out.referenceDisplayAttributeId = a.referenceDisplayAttributeId.trim()
  }
  if (a.type === 'composite') out.compositeFields = a.compositeFields ?? []
  return out
}

function save(): void {
  if (!form.value || !form.value.name.trim()) return
  emit('save', clean(form.value))
  visible.value = false
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="form?.name ? `Атрибут «${form.name}»` : 'Атрибут'" class="w-full max-w-xl" :draggable="false">
    <div v-if="form" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <UiField label="Наименование" for-id="af-name" required class="sm:col-span-2">
        <InputText id="af-name" v-model="form.name" fluid />
      </UiField>
      <UiField label="Идентификатор" for-id="af-id" hint="Технический ключ в API и выгрузках">
        <InputText id="af-id" :model-value="form.id" class="code-font" disabled fluid />
      </UiField>
      <UiField label="Тип" for-id="af-type">
        <Select v-model="form.type" input-id="af-type" :options="types" option-label="label" option-value="type" fluid />
      </UiField>

      <label class="flex items-center gap-2 text-sm"><Checkbox v-model="form.required" binary />Обязательный</label>
      <label class="flex items-center gap-2 text-sm">
        <Checkbox :model-value="form.listed !== false" binary @update:model-value="(v: boolean) => form && (form.listed = v)" />Показывать в таблице
      </label>

      <template v-if="form.type === 'string'">
        <UiField label="Макс. длина" for-id="af-maxlen">
          <InputNumber v-model="form.maxLength" input-id="af-maxlen" :min="1" fluid />
        </UiField>
        <UiField label="Шаблон (регулярное выражение)" for-id="af-pattern" hint="Напр.: ^\d{10}$">
          <InputText id="af-pattern" v-model="form.pattern" class="code-font" fluid />
        </UiField>
      </template>

      <template v-if="isNumber">
        <UiField label="Минимум" for-id="af-min"><InputNumber v-model="form.min" input-id="af-min" :max-fraction-digits="6" fluid /></UiField>
        <UiField label="Максимум" for-id="af-max"><InputNumber v-model="form.max" input-id="af-max" :max-fraction-digits="6" fluid /></UiField>
      </template>

      <template v-if="form.type === 'reference'">
        <UiField label="Справочник" for-id="af-ref" required>
          <Select v-model="form.referenceCatalogId" input-id="af-ref" :options="props.catalogs" option-label="name" option-value="id" placeholder="Выберите" fluid />
        </UiField>
        <UiField label="Показывать атрибут" for-id="af-refattr" hint="id атрибута целевого справочника; пусто — наименование">
          <InputText id="af-refattr" v-model="form.referenceDisplayAttributeId" class="code-font" fluid />
        </UiField>
      </template>

      <p v-if="form.type === 'composite'" class="text-sm text-ink-2 sm:col-span-2">Поля составного типа добавляются в таблице атрибутов.</p>

      <UiField label="Ширина колонки, px" for-id="af-width">
        <InputNumber v-model="form.width" input-id="af-width" :min="60" :max="800" fluid />
      </UiField>
    </div>
    <template #footer>
      <Button label="Отмена" severity="secondary" text @click="visible = false" />
      <Button label="Применить" :disabled="!form?.name.trim()" @click="save" />
    </template>
  </Dialog>
</template>
