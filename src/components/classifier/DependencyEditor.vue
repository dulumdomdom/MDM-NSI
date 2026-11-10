<script setup lang="ts">
// Редактор правил зависимостей фасета-триггера. Правила — данные: компонент только редактирует список.
import { computed } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ConditionEditor from './ConditionEditor.vue'
import { optionsToText, parseOptionsText } from '@/composables/useClassifierConfig'
import type { CodeName, FacetConfig, FacetDependencyRule, FacetOverride, TransitionCondition } from '@/types'

const props = defineProps<{ facet: FacetConfig; facets: FacetConfig[]; issues: { ruleId: string; message: string }[] }>()
const emit = defineEmits<{ 'update:rules': [rules: FacetDependencyRule[]] }>()

const rules = computed(() => props.facet.dependencies ?? [])
const targets = computed(() => props.facets.filter((f) => f.id !== props.facet.id).map((f) => ({ id: f.id, name: f.name })))
const visibilityOptions = [
  { value: 'keep', label: 'не менять' },
  { value: 'show', label: 'показать' },
  { value: 'hide', label: 'скрыть' },
]

const update = (next: FacetDependencyRule[]) => emit('update:rules', next)
const patchRule = (i: number, patch: Partial<FacetDependencyRule>) =>
  update(rules.value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

function addRule(): void {
  update([
    ...rules.value,
    { id: `r-${props.facet.id}-${Date.now().toString(36)}`, triggerFacetId: props.facet.id, triggerValue: '', overrides: [] },
  ])
}

const removeRule = (i: number) => update(rules.value.filter((_, idx) => idx !== i))

function setCondition(i: number, c: TransitionCondition | undefined): void {
  const { triggerCondition: _old, ...rest } = rules.value[i] ?? { id: '', triggerFacetId: '', triggerValue: '', overrides: [] }
  update(rules.value.map((r, idx) => (idx === i ? (c ? { ...rest, triggerCondition: c } : rest) : r)))
}

function patchOverride(i: number, j: number, patch: Partial<FacetOverride>, drop: (keyof FacetOverride)[] = []): void {
  const rule = rules.value[i]
  if (!rule) return
  const overrides = rule.overrides.map((o, idx) => {
    if (idx !== j) return o
    const next: FacetOverride = { ...o, ...patch }
    for (const k of drop) delete next[k]
    return next
  })
  patchRule(i, { overrides })
}

const addOverride = (i: number) =>
  patchRule(i, { overrides: [...(rules.value[i]?.overrides ?? []), { facetId: targets.value[0]?.id ?? '' }] })
const removeOverride = (i: number, j: number) =>
  patchRule(i, { overrides: (rules.value[i]?.overrides ?? []).filter((_, idx) => idx !== j) })

const visibilityOf = (o: FacetOverride) => (o.visible === undefined ? 'keep' : o.visible ? 'show' : 'hide')
function setVisibility(i: number, j: number, v: string): void {
  if (v === 'keep') patchOverride(i, j, {}, ['visible'])
  else patchOverride(i, j, { visible: v === 'show' })
}
function setOptions(i: number, j: number, text: string): void {
  const opts = parseOptionsText(text)
  if (opts.length === 0) patchOverride(i, j, {}, ['options'])
  else patchOverride(i, j, { options: opts })
}
function setLabel(i: number, j: number, label: string | undefined): void {
  if (!label) patchOverride(i, j, {}, ['label'])
  else patchOverride(i, j, { label })
}

const optionText = (o: CodeName) => `${o.code} — ${o.name}`
const ruleIssues = (id: string) => props.issues.filter((x) => x.ruleId === id)
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm text-ink-3">
      Правила срабатывают на значении фасета «{{ facet.name }}» и меняют фасеты, идущие после него в пути структуры.
    </p>
    <div v-for="(rule, i) in rules" :key="rule.id" class="rounded-lg border border-line p-3">
      <div class="mb-2 flex items-center gap-2">
        <InputText
          :model-value="rule.description ?? ''"
          placeholder="Описание правила"
          class="flex-1"
          aria-label="Описание правила"
          @update:model-value="(v) => patchRule(i, { description: v ?? '' })"
        />
        <Button icon="pi pi-trash" severity="danger" text aria-label="Удалить правило" @click="removeRule(i)" />
      </div>

      <div class="mb-3 grid gap-2 md:grid-cols-[auto_1fr] md:items-center">
        <span class="text-sm text-ink-2">Если значение</span>
        <div>
          <Select
            v-if="facet.options && !rule.triggerCondition"
            :model-value="String(rule.triggerValue)"
            :options="facet.options"
            option-value="code"
            :option-label="optionText"
            class="w-full"
            aria-label="Значение-триггер"
            @update:model-value="(v: string) => patchRule(i, { triggerValue: v })"
          />
          <InputText
            v-else-if="!rule.triggerCondition"
            :model-value="String(rule.triggerValue)"
            class="code-font w-full"
            aria-label="Значение-триггер"
            @update:model-value="(v) => patchRule(i, { triggerValue: v ?? '' })"
          />
        </div>
        <span class="text-sm text-ink-2">или условие</span>
        <ConditionEditor :model-value="rule.triggerCondition" @update:model-value="(c) => setCondition(i, c)" />
      </div>

      <div class="flex flex-col gap-2">
        <div v-for="(ov, j) in rule.overrides" :key="j" class="grid gap-2 rounded bg-canvas p-2 md:grid-cols-2">
          <Select
            :model-value="ov.facetId"
            :options="targets"
            option-value="id"
            option-label="name"
            aria-label="Зависимый фасет"
            @update:model-value="(v: string) => patchOverride(i, j, { facetId: v })"
          />
          <Select
            :model-value="visibilityOf(ov)"
            :options="visibilityOptions"
            option-value="value"
            option-label="label"
            aria-label="Видимость"
            @update:model-value="(v: string) => setVisibility(i, j, v)"
          />
          <InputText
            :model-value="ov.label ?? ''"
            placeholder="Новая подпись (не менять — пусто)"
            aria-label="Новая подпись"
            @update:model-value="(v) => setLabel(i, j, v)"
          />
          <div class="flex gap-2">
            <Textarea
              :model-value="optionsToText(ov.options)"
              placeholder="Значения: «код = наименование» по строкам"
              rows="2"
              class="code-font flex-1 text-xs"
              aria-label="Новые значения"
              @change="(e: Event) => setOptions(i, j, (e.target as HTMLTextAreaElement).value)"
            />
            <Button icon="pi pi-times" severity="secondary" text aria-label="Убрать переопределение" @click="removeOverride(i, j)" />
          </div>
        </div>
        <Button label="Переопределение" icon="pi pi-plus" size="small" text class="self-start" @click="addOverride(i)" />
      </div>
      <ul v-if="ruleIssues(rule.id).length" class="mt-2 text-xs text-red-600">
        <li v-for="(x, k) in ruleIssues(rule.id)" :key="k">{{ x.message }}</li>
      </ul>
    </div>
    <Button label="Добавить правило" icon="pi pi-plus" outlined class="self-start" @click="addRule" />
  </div>
</template>
