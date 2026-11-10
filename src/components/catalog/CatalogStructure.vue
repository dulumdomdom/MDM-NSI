<script setup lang="ts">
// Структура справочника: свойства, атрибуты (в т.ч. поля составных), состояния. Правки — в черновике useCatalogConfig.
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import AttributeForm from './AttributeForm.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiField from '@/components/ui/UiField.vue'
import UiPromptDialog from '@/components/ui/UiPromptDialog.vue'
import type { useCatalogConfig } from '@/composables/useCatalogConfig'
import { ATTRIBUTE_TYPES, STATE_COLORS } from '@/lib/catalogSchema'
import type { AttributeType, CatalogAttribute, CatalogSummary } from '@/types'

const props = defineProps<{ config: ReturnType<typeof useCatalogConfig>; catalogs: CatalogSummary[] }>()
const cfg = props.config
const draft = computed(() => cfg.draft.value)

const typeLabel = (t: AttributeType) => ATTRIBUTE_TYPES.find((x) => x.type === t)?.label ?? t
const colorDot: Record<string, string> = {
  success: 'bg-emerald-500',
  info: 'bg-brand',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
  secondary: 'bg-slate-400',
  contrast: 'bg-ink',
}

/* Добавление атрибута: имя + тип; parentId — поле составного */
const addVisible = ref(false)
const addType = ref<AttributeType>('string')
const addParent = ref<string | undefined>(undefined)
function openAdd(parentId?: string): void {
  addParent.value = parentId
  addType.value = 'string'
  addVisible.value = true
}

/* Редактирование атрибута */
const formVisible = ref(false)
const formAttr = ref<CatalogAttribute | null>(null)
const formParent = ref<string | undefined>(undefined)
function openEdit(a: CatalogAttribute, parentId?: string): void {
  formAttr.value = a
  formParent.value = parentId
  formVisible.value = true
}

const stateVisible = ref(false)
</script>

<template>
  <div v-if="draft" class="flex flex-col gap-5">
    <!-- Свойства -->
    <UiCard title="Свойства">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <UiField label="Наименование" for-id="cs-name" required>
          <InputText id="cs-name" :model-value="draft.name" fluid @update:model-value="(v) => cfg.setGeneral({ name: v ?? '' })" />
        </UiField>
        <UiField label="Атрибут-наименование" for-id="cs-display" hint="Подпись элемента в ссылках, поиске, заявках">
          <Select
            :model-value="draft.displayAttributeId"
            input-id="cs-display"
            :options="draft.attributes.filter((a) => a.type === 'string')"
            option-label="name"
            option-value="id"
            fluid
            @update:model-value="(v: string) => cfg.setGeneral({ displayAttributeId: v })"
          />
        </UiField>
        <UiField label="Описание" for-id="cs-desc" class="md:col-span-2">
          <Textarea id="cs-desc" :model-value="draft.description ?? ''" rows="2" auto-resize fluid @update:model-value="(v) => cfg.setGeneral({ description: v })" />
        </UiField>
        <label class="flex items-center gap-3 text-sm">
          <ToggleSwitch :model-value="draft.hierarchical" @update:model-value="(v: boolean) => cfg.setGeneral({ hierarchical: v })" />
          <span><b class="font-semibold text-ink">Иерархический</b> <span class="text-ink-3">— группы и перенос элементов между ними</span></span>
        </label>
      </div>
    </UiCard>

    <!-- Атрибуты -->
    <UiCard title="Атрибуты" flush>
      <template #actions>
        <Button label="Атрибут" icon="pi pi-plus" size="small" text data-testid="attr-add" @click="openAdd()" />
      </template>
      <div class="grid grid-cols-[52px_1.4fr_1fr_90px_90px_92px] gap-3 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
        <span /><span>Наименование</span><span>Тип</span><span>Обязат.</span><span>В таблице</span><span />
      </div>
      <template v-for="(a, i) in draft.attributes" :key="a.id">
        <div class="grid grid-cols-[52px_1.4fr_1fr_90px_90px_92px] items-center gap-3 border-b border-line px-4 py-2.5">
          <div class="flex">
            <Button icon="pi pi-arrow-up" text rounded size="small" severity="secondary" :disabled="i === 0" aria-label="Выше" @click="cfg.moveAttribute(a.id, -1)" />
          </div>
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-ink">
              {{ a.name }}
              <span v-if="a.id === draft.displayAttributeId" class="ml-1 rounded bg-brand-soft px-1.5 py-0.5 text-2xs font-semibold text-brand-dark">наименование</span>
            </div>
            <div class="code-font text-2xs text-ink-3">{{ a.id }}</div>
          </div>
          <span class="text-sm text-ink-2">
            {{ typeLabel(a.type) }}
            <template v-if="a.type === 'reference'"> → {{ props.catalogs.find((c) => c.id === a.referenceCatalogId)?.name ?? '?' }}</template>
          </span>
          <i :class="a.required ? 'pi pi-check text-brand' : 'pi pi-minus text-line-strong'" class="text-xs" />
          <i :class="a.listed !== false ? 'pi pi-check text-brand' : 'pi pi-minus text-line-strong'" class="text-xs" />
          <div class="flex justify-end">
            <Button icon="pi pi-pencil" text rounded size="small" severity="secondary" aria-label="Изменить" @click="openEdit(a)" />
            <Button icon="pi pi-trash" text rounded size="small" severity="secondary" aria-label="Удалить" @click="cfg.removeAttribute(a.id)" />
          </div>
        </div>
        <!-- Поля составного типа -->
        <div v-if="a.type === 'composite'" class="border-b border-line bg-canvas/50 py-1 pl-16 pr-4">
          <div v-for="f in a.compositeFields ?? []" :key="f.id" class="grid grid-cols-[1.4fr_1fr_90px_92px] items-center gap-3 py-1.5">
            <span class="text-sm text-ink">↳ {{ f.name }} <span class="code-font text-2xs text-ink-3">{{ f.id }}</span></span>
            <span class="text-sm text-ink-2">{{ typeLabel(f.type) }}</span>
            <i :class="f.required ? 'pi pi-check text-brand' : 'pi pi-minus text-line-strong'" class="text-xs" />
            <div class="flex justify-end">
              <Button icon="pi pi-pencil" text rounded size="small" severity="secondary" aria-label="Изменить поле" @click="openEdit(f, a.id)" />
              <Button icon="pi pi-trash" text rounded size="small" severity="secondary" aria-label="Удалить поле" @click="cfg.removeAttribute(f.id, a.id)" />
            </div>
          </div>
          <Button label="Поле" icon="pi pi-plus" size="small" text class="my-1" @click="openAdd(a.id)" />
        </div>
      </template>
    </UiCard>

    <!-- Состояния -->
    <UiCard title="Состояния элементов" flush>
      <template #actions>
        <Button label="Состояние" icon="pi pi-plus" size="small" text @click="stateVisible = true" />
      </template>
      <div
        v-for="s in draft.states"
        :key="s.id"
        class="grid grid-cols-[1.4fr_1fr_160px_40px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
      >
        <InputText :model-value="s.name" size="small" @update:model-value="(v) => cfg.updateState(s.id, { name: v ?? '' })" />
        <Select
          :model-value="s.color"
          :options="STATE_COLORS"
          option-label="label"
          option-value="value"
          size="small"
          @update:model-value="(v: typeof s.color) => cfg.updateState(s.id, { color: v })"
        >
          <template #value="{ value }">
            <span class="flex items-center gap-2"><i class="h-2 w-2 rounded-full" :class="colorDot[String(value)]" />{{ STATE_COLORS.find((c) => c.value === value)?.label }}</span>
          </template>
        </Select>
        <label class="flex items-center gap-2 text-sm text-ink-2">
          <input type="radio" name="initial-state" :checked="s.initial" class="accent-[var(--brand)]" @change="cfg.updateState(s.id, { initial: true })" />
          начальное
        </label>
        <Button icon="pi pi-trash" text rounded size="small" severity="secondary" aria-label="Удалить состояние" @click="cfg.removeState(s.id)" />
      </div>
    </UiCard>

    <UiPromptDialog
      v-model:visible="addVisible"
      :title="addParent ? 'Новое поле составного типа' : 'Новый атрибут'"
      submit-label="Добавить"
      @submit="(name) => cfg.addAttribute(name, addType, addParent)"
    >
      <label for="attr-type" class="mt-2 text-xs font-medium text-ink-2">Тип</label>
      <Select
        v-model="addType"
        input-id="attr-type"
        :options="addParent ? ATTRIBUTE_TYPES.filter((t) => t.type !== 'composite') : ATTRIBUTE_TYPES"
        option-label="label"
        option-value="type"
        fluid
      />
    </UiPromptDialog>
    <UiPromptDialog v-model:visible="stateVisible" title="Новое состояние" submit-label="Добавить" @submit="cfg.addState" />
    <AttributeForm
      v-model:visible="formVisible"
      :attribute="formAttr"
      :catalogs="props.catalogs"
      :nested="!!formParent"
      @save="(a) => cfg.replaceAttribute(a, formParent)"
    />
  </div>
</template>
