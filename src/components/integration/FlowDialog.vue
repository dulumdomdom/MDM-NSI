<script setup lang="ts">
// Настройка потока обмена: когда запускается, какие элементы уходят, какие поля во что превращаются.
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import ToggleSwitch from 'primevue/toggleswitch'
import UiField from '@/components/ui/UiField.vue'
import { deepClone } from '@/lib/clone'
import { describeTrigger, sourceLabel } from '@/lib/integration'
import type { Catalog, FlowSchedule, IntegrationFlow } from '@/types'

const props = defineProps<{
  flow: IntegrationFlow | null
  catalog: Catalog | null
  systemName: string
  classifierName: (id: string) => string
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ save: [flow: IntegrationFlow] }>()

const draft = ref<IntegrationFlow | null>(null)
watch(visible, (v) => {
  if (v && props.flow) draft.value = deepClone(props.flow)
})

const SCHEDULES: { value: FlowSchedule; label: string }[] = [
  { value: 'none', label: 'Нет' },
  { value: 'hourly', label: 'Ежечасно' },
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
]
const IMPORT_MODES = [
  { value: 'request', label: 'Через заявку модераторам' },
  { value: 'direct', label: 'Сразу в справочник' },
]

const isExport = computed(() => draft.value?.direction === 'export')
const states = computed(() => props.catalog?.states ?? [])
const codeClassifiers = computed(() => (props.catalog?.classifierBindings ?? []).map((b) => ({ id: b.classifierId, name: props.classifierName(b.classifierId) })))

/** Источники значений: служебные поля, атрибуты справочника, шифры привязанных классификаторов */
const sources = computed(() => {
  const ids = ['$id', '$state', ...(props.catalog?.attributes.map((a) => a.id) ?? []), ...codeClassifiers.value.map((c) => `code:${c.id}`)]
  return ids.map((id) => ({ id, label: sourceLabel(id, props.catalog, props.classifierName) }))
})

const errors = computed(() => {
  const d = draft.value
  if (!d) return []
  const out: string[] = []
  if (!d.name.trim()) out.push('Укажите название потока')
  if (d.mapping.length === 0) out.push('Добавьте хотя бы одно поле')
  if (d.mapping.some((m) => !m.target.trim())) out.push('У каждого поля должно быть имя во внешней системе')
  const targets = d.mapping.map((m) => m.target.trim())
  if (new Set(targets).size !== targets.length) out.push('Имена полей во внешней системе повторяются')
  return out
})

function addRow(): void {
  draft.value?.mapping.push({ source: 'name', target: '' })
}

function save(): void {
  if (draft.value && errors.value.length === 0) emit('save', { ...draft.value, mapping: draft.value.mapping.map((m) => ({ ...m, target: m.target.trim() })) })
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="`Поток обмена · ${props.systemName}`" class="w-full max-w-3xl" :draggable="false">
    <div v-if="draft" class="flex flex-col gap-5" data-testid="flow-dialog">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
        <UiField label="Название" for-id="fl-name" required>
          <InputText id="fl-name" v-model="draft.name" fluid />
        </UiField>
        <UiField label="Поток включён" for-id="fl-enabled">
          <ToggleSwitch v-model="draft.enabled" input-id="fl-enabled" />
        </UiField>
      </div>

      <p class="rounded bg-canvas px-3 py-2 text-sm text-ink-2">
        <b class="text-brand-dark">{{ isExport ? 'Выгрузка из MDM' : 'Загрузка в MDM' }}</b> · справочник «{{ props.catalog?.name ?? draft.catalogId }}» ·
        запуск: {{ describeTrigger(draft.trigger) }}
      </p>

      <section class="flex flex-col gap-3">
        <h3 class="text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">Когда запускать</h3>
        <label v-if="isExport" class="flex items-center gap-2 text-sm">
          <Checkbox v-model="draft.trigger.onEvent" binary />
          Сразу при изменении элемента или утверждении шифра
        </label>
        <UiField label="По расписанию" for-id="fl-schedule">
          <SelectButton v-model="draft.trigger.schedule" :options="SCHEDULES" option-label="label" option-value="value" :allow-empty="false" />
        </UiField>
      </section>

      <section v-if="isExport" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UiField label="Выгружать состояния" for-id="fl-states" hint="Пусто — любые">
          <MultiSelect v-model="draft.states" input-id="fl-states" :options="states" option-label="name" option-value="id" placeholder="Любые" display="chip" fluid />
        </UiField>
        <UiField label="Только с утверждённым шифром" for-id="fl-codes" hint="Например, Imbase принимает только зашифрованный инструмент">
          <MultiSelect v-model="draft.requireCodes" input-id="fl-codes" :options="codeClassifiers" option-label="name" option-value="id" placeholder="Не требуется" display="chip" fluid />
        </UiField>
      </section>
      <section v-else>
        <UiField label="Новые записи" for-id="fl-mode" hint="Через заявку — модераторы проверяют и шифруют, как пополнение от пользователя">
          <SelectButton v-model="draft.importMode" :options="IMPORT_MODES" option-label="label" option-value="value" :allow-empty="false" />
        </UiField>
      </section>

      <section class="flex flex-col gap-2">
        <div class="flex items-center justify-between">
          <h3 class="text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">Сопоставление полей</h3>
          <Button label="Поле" icon="pi pi-plus" size="small" text @click="addRow" />
        </div>
        <div class="overflow-hidden rounded-lg border border-line">
          <div class="grid grid-cols-[1fr_24px_1fr_110px_40px] items-center gap-3 border-b border-line bg-brand-soft px-3 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
            <span>{{ isExport ? 'Поле MDM' : 'Поле MDM (куда)' }}</span><span /><span>Поле в {{ props.systemName }}</span><span>Обязательно</span><span />
          </div>
          <div v-for="(m, i) in draft.mapping" :key="i" class="grid grid-cols-[1fr_24px_1fr_110px_40px] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
            <Select v-model="m.source" :options="sources" option-label="label" option-value="id" size="small" fluid :aria-label="`Источник ${i + 1}`" />
            <i class="pi text-ink-3" :class="isExport ? 'pi-arrow-right' : 'pi-arrow-left'" />
            <InputText v-model="m.target" size="small" class="code-font" fluid :aria-label="`Поле внешней системы ${i + 1}`" />
            <Checkbox v-model="m.required" binary class="justify-self-center" :aria-label="`Обязательно ${i + 1}`" />
            <Button icon="pi pi-times" text rounded size="small" severity="secondary" :aria-label="`Удалить поле ${i + 1}`" @click="draft.mapping.splice(i, 1)" />
          </div>
        </div>
        <p class="text-xs text-ink-3">
          {{ isExport ? 'Если обязательное поле у элемента пусто — он не уйдёт, а ошибка попадёт в журнал и в карточку элемента.' : 'Записи без обязательных полей пропускаются.' }}
        </p>
      </section>

      <ul v-if="errors.length" class="flex flex-col gap-0.5 text-sm text-red-600">
        <li v-for="e in errors" :key="e">{{ e }}</li>
      </ul>
    </div>
    <template #footer>
      <Button label="Отмена" severity="secondary" text @click="visible = false" />
      <Button label="Сохранить" icon="pi pi-check" :disabled="errors.length > 0" data-testid="flow-save" @click="save" />
    </template>
  </Dialog>
</template>
