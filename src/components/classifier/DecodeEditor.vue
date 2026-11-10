<script setup lang="ts">
// Расшифровка: структуры по каталогам (первая подходящая по условиям, иначе — все фасеты через пробел)
// и правило краткого наименования.
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import ConditionEditor from './ConditionEditor.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import type { useClassifierConfig } from '@/composables/useClassifierConfig'
import { getCatalogs } from '@/lib/classifier'
import type { DecodePart, DecodeStructure, ShortNameRule, TransitionCondition } from '@/types'

const props = defineProps<{ config: ReturnType<typeof useClassifierConfig> }>()
const cfg = props.config
const draft = computed(() => cfg.draft.value)

const catalogs = computed(() => (draft.value ? getCatalogs(draft.value) : []))
const catalogId = ref<string | null>(null)
watch(
  catalogs,
  (list) => {
    if (!list.some((c) => c.id === catalogId.value)) catalogId.value = list[0]?.id ?? null
  },
  { immediate: true },
)
const structures = computed(() => catalogs.value.find((c) => c.id === catalogId.value)?.decodeStructures ?? [])

const FORMATS = [
  { value: 'name', label: 'наименование' },
  { value: 'code', label: 'код' },
  { value: 'label-name', label: 'подпись + наименование' },
]
const KINDS = [
  { value: 'facet', label: 'Фасет' },
  { value: 'text', label: 'Текст' },
]

/* Правки структур — новым списком */
function setList(list: DecodeStructure[]): void {
  if (catalogId.value) cfg.setDecodeStructures(catalogId.value, list)
}
const patch = (i: number, p: Partial<DecodeStructure>) => setList(structures.value.map((s, k) => (k === i ? { ...s, ...p } : s)))

function addStructure(): void {
  setList([...structures.value, { id: `ds-${Date.now().toString(36)}`, name: 'Новая структура', conditions: [], parts: [] }])
}
const removeStructure = (i: number) => setList(structures.value.filter((_, k) => k !== i))

function addCondition(i: number): void {
  const s = structures.value[i]
  const facetId = draft.value?.facets[0]?.id
  if (s && facetId) patch(i, { conditions: [...s.conditions, { facetId, condition: { type: 'string', value: '' } }] })
}
function setCondition(i: number, j: number, p: { facetId?: string; condition?: TransitionCondition }): void {
  const s = structures.value[i]
  if (s) patch(i, { conditions: s.conditions.map((c, k) => (k === j ? { ...c, ...p } : c)) })
}
const removeCondition = (i: number, j: number) => patch(i, { conditions: structures.value[i]?.conditions.filter((_, k) => k !== j) ?? [] })

function addPart(i: number): void {
  const s = structures.value[i]
  const facetId = draft.value?.facets[0]?.id ?? ''
  if (s) patch(i, { parts: [...s.parts, { kind: 'facet', facetId }] })
}
function setPart(i: number, j: number, part: DecodePart): void {
  const s = structures.value[i]
  if (s) patch(i, { parts: s.parts.map((p, k) => (k === j ? part : p)) })
}
function changeKind(i: number, j: number, kind: 'facet' | 'text'): void {
  setPart(i, j, kind === 'text' ? { kind: 'text', text: '' } : { kind: 'facet', facetId: draft.value?.facets[0]?.id ?? '' })
}
function movePart(i: number, j: number, delta: -1 | 1): void {
  const s = structures.value[i]
  if (!s) return
  const list = [...s.parts]
  const a = list[j]
  const b = list[j + delta]
  if (!a || !b) return
  list[j] = b
  list[j + delta] = a
  patch(i, { parts: list })
}
const removePart = (i: number, j: number) => patch(i, { parts: structures.value[i]?.parts.filter((_, k) => k !== j) ?? [] })

/* Краткое наименование */
const rule = computed(() => draft.value?.shortNameRule)
function setRule(p: Partial<ShortNameRule>): void {
  cfg.setShortNameRule({ facetIds: [], template: '', ...rule.value, ...p })
}
const CASES = [
  { value: null, label: 'как есть' },
  { value: 'sentence', label: 'Как в предложении' },
  { value: 'upper', label: 'ПРОПИСНЫЕ' },
  { value: 'lower', label: 'строчные' },
]
</script>

<template>
  <div v-if="draft" class="flex flex-col gap-5">
    <UiCard title="Структуры расшифровки" flush>
      <template #actions>
        <div class="flex items-center gap-2">
          <Select v-model="catalogId" :options="catalogs" option-label="name" option-value="id" size="small" class="w-56" aria-label="Каталог" />
          <Button label="Структура" icon="pi pi-plus" size="small" text :disabled="!catalogId" @click="addStructure" />
        </div>
      </template>
      <p class="px-4 pt-3 text-sm text-ink-2">
        Выбирается <b>первая</b> структура, у которой выполнены все условия. Если ни одна не подошла — расшифровка по умолчанию: значения всех
        фасетов через пробел. Префикс и суффикс фасета выводятся только вместе с его значением.
      </p>
      <UiEmpty v-if="structures.length === 0" text="Структур нет — используется расшифровка по умолчанию" />

      <div v-for="(s, i) in structures" :key="s.id" class="mt-3 border-t border-line px-4 py-4">
        <div class="mb-3 flex items-center gap-2">
          <span class="text-sm font-bold text-brand-dark">{{ i + 1 }}.</span>
          <InputText :model-value="s.name" size="small" class="w-72" aria-label="Название структуры" @update:model-value="(v) => patch(i, { name: v ?? '' })" />
          <span class="flex-1" />
          <Button icon="pi pi-trash" text rounded size="small" severity="secondary" aria-label="Удалить структуру" @click="removeStructure(i)" />
        </div>

        <div class="mb-2 text-2xs font-bold uppercase tracking-[0.06em] text-ink-3">Условия (все должны выполняться)</div>
        <div v-for="(c, j) in s.conditions" :key="j" class="mb-2 grid grid-cols-[200px_1fr_40px] items-start gap-2">
          <Select :model-value="c.facetId" :options="draft.facets" option-label="name" option-value="id" size="small" @update:model-value="(v: string) => setCondition(i, j, { facetId: v })" />
          <ConditionEditor :model-value="c.condition" @update:model-value="(v) => v && setCondition(i, j, { condition: v })" />
          <Button icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Удалить условие" @click="removeCondition(i, j)" />
        </div>
        <Button label="Условие" icon="pi pi-plus" size="small" text class="mb-3" @click="addCondition(i)" />

        <div class="mb-2 text-2xs font-bold uppercase tracking-[0.06em] text-ink-3">Части расшифровки (по порядку)</div>
        <div v-for="(p, j) in s.parts" :key="j" class="mb-2 flex flex-wrap items-center gap-2">
          <Select :model-value="p.kind" :options="KINDS" option-label="label" option-value="value" size="small" class="w-28" @update:model-value="(v: 'facet' | 'text') => changeKind(i, j, v)" />
          <template v-if="p.kind === 'facet'">
            <InputText :model-value="p.prefix ?? ''" placeholder="префикс" size="small" class="w-24" @update:model-value="(v) => setPart(i, j, { ...p, prefix: v || undefined })" />
            <Select :model-value="p.facetId" :options="draft.facets" option-label="name" option-value="id" size="small" class="w-56" @update:model-value="(v: string) => setPart(i, j, { ...p, facetId: v })" />
            <Select
              :model-value="p.format ?? 'name'"
              :options="FORMATS"
              option-label="label"
              option-value="value"
              size="small"
              class="w-48"
              @update:model-value="(v: 'name' | 'code' | 'label-name') => setPart(i, j, { ...p, format: v })"
            />
            <InputText :model-value="p.suffix ?? ''" placeholder="суффикс" size="small" class="w-24" @update:model-value="(v) => setPart(i, j, { ...p, suffix: v || undefined })" />
          </template>
          <InputText v-else :model-value="p.text" placeholder="текст" size="small" class="w-72" @update:model-value="(v) => setPart(i, j, { kind: 'text', text: v ?? '' })" />
          <Button icon="pi pi-arrow-up" text rounded size="small" severity="secondary" :disabled="j === 0" aria-label="Выше" @click="movePart(i, j, -1)" />
          <Button icon="pi pi-arrow-down" text rounded size="small" severity="secondary" :disabled="j === s.parts.length - 1" aria-label="Ниже" @click="movePart(i, j, 1)" />
          <Button icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Удалить часть" @click="removePart(i, j)" />
        </div>
        <Button label="Часть" icon="pi pi-plus" size="small" text @click="addPart(i)" />
      </div>
    </UiCard>

    <UiCard title="Краткое наименование">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label class="flex flex-col gap-1.5 md:col-span-2">
          <span class="text-xs font-medium text-ink-2">Шаблон</span>
          <InputText
            :model-value="rule?.template ?? ''"
            class="code-font"
            placeholder="{f-group} {f-type}[ Ø{f-diameter:code}]"
            @update:model-value="(v) => setRule({ template: v ?? '' })"
          />
          <small class="text-xs text-ink-3">
            <span class="code-font">{id}</span> — наименование значения, <span class="code-font">{id:code}</span> — код,
            <span class="code-font">[ … ]</span> — блок выводится, только если все значения внутри заполнены.
          </small>
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="text-xs font-medium text-ink-2">Фасеты, доступные в шаблоне</span>
          <MultiSelect
            :model-value="rule?.facetIds ?? []"
            :options="draft.facets"
            option-label="name"
            option-value="id"
            display="chip"
            placeholder="—"
            @update:model-value="(v: string[]) => setRule({ facetIds: v })"
          />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-ink-2">Регистр</span>
            <Select
              :model-value="rule?.normalize?.case ?? null"
              :options="CASES"
              option-label="label"
              option-value="value"
              @update:model-value="(v: 'upper' | 'lower' | 'sentence' | null) => setRule({ normalize: { ...rule?.normalize, case: v ?? undefined } })"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-ink-2">Макс. длина</span>
            <InputNumber
              :model-value="rule?.normalize?.maxLength ?? null"
              :min="10"
              @update:model-value="(v: number | null) => setRule({ normalize: { ...rule?.normalize, maxLength: v ?? undefined } })"
            />
          </label>
        </div>
        <div v-if="rule" class="md:col-span-2">
          <Button label="Отключить краткое наименование" severity="secondary" text size="small" @click="cfg.setShortNameRule(undefined)" />
        </div>
      </div>
    </UiCard>

    <p class="text-xs text-ink-3">
      Идентификаторы фасетов для шаблона:
      <span v-for="f in draft.facets" :key="f.id" class="code-font mr-2 whitespace-nowrap">{{ f.id }}</span>
    </p>
  </div>
</template>
