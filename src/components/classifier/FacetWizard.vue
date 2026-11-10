<script setup lang="ts">
// Режим wizard: фасеты текущего пути по смысловым блокам (секции из конфига) — как бланк классификатора.
// Строка фасета: позиция и формат сегмента | значения (плитки «код — наименование» или поле) | сегмент шифра.
// Поля строятся по ЭФФЕКТИВНЫМ фасетам — label/options/visible уже учитывают зависимости.
// После выбора фокус переходит к следующему пустому фасету: заполнение идёт сверху вниз без мыши.
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import FacetOptions from './FacetOptions.vue'
import { facetInputId, useClassifier } from '@/composables/useClassifier'
import type { ParsedFacet } from '@/lib/classifier'

/** Только просмотр: режим wizard не разрешён конфигом — показываем разбор шифра */
const props = defineProps<{ readonly?: boolean }>()

/** До скольких значений показываем плитками, дальше — список с поиском */
const TILES_LIMIT = 12

const { store, ruleDescriptions, focusNext } = useClassifier()

const fieldError = (f: ParsedFacet) => (f.value !== '' ? f.issues[0]?.message : undefined)
const optionLabel = (o: { code: string; name: string }) => (o.name === o.code ? o.code : `${o.code} — ${o.name}`)
const pad = (n: number) => String(n).padStart(2, '0')

const TYPE: Record<string, string> = { int: 'целое', float: 'дробное', string: 'текст', bool: 'да/нет' }
/** Формат сегмента в шифре: «2 зн. · текст», «до «-» · целое», «остаток · текст» */
function format(f: ParsedFacet): string {
  const c = f.config
  const len =
    c.lengthMode === 'fixed' ? `${c.fixedLength ?? c.defaultLength} зн.` : c.lengthMode === 'delimiter' && c.delimiter ? `до «${c.delimiter}»` : 'остаток шифра'
  return `${len} · ${TYPE[c.dataType] ?? c.dataType}`
}

function state(f: ParsedFacet): 'ok' | 'error' | 'empty' {
  if (f.value === '') return 'empty'
  return f.issues.length ? 'error' : 'ok'
}

/** Выбор значения → сразу к следующему фасету */
function choose(f: ParsedFacet, v: string | null | undefined): void {
  store.setFacetById(f.facetId, v ?? '')
  if (v) void focusNext(f.facetId)
}
const type = (f: ParsedFacet, v: string | undefined) => store.setFacetById(f.facetId, v ?? '')
const done = (facets: ParsedFacet[]) => facets.filter((f) => state(f) === 'ok').length
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-line bg-white" data-testid="facet-wizard">
    <section v-for="(g, gi) in store.sections" :key="g.section.id">
      <header class="flex items-center gap-3 border-b border-line bg-canvas px-4 py-2">
        <span class="code-font text-2xs font-bold text-brand">{{ pad(gi + 1) }}</span>
        <h3 class="text-2xs font-bold uppercase tracking-[0.1em] text-brand-dark">{{ g.section.name }}</h3>
        <span class="ml-auto flex items-center gap-2 text-2xs font-semibold text-ink-3">
          <span class="flex gap-0.5" aria-hidden="true">
            <i v-for="f in g.facets" :key="f.facetId" class="h-1.5 w-3 rounded-[1px]" :class="{ 'bg-brand': state(f) === 'ok', 'bg-[var(--danger)]': state(f) === 'error', 'bg-line-strong': state(f) === 'empty' }" />
          </span>
          {{ done(g.facets) }}/{{ g.facets.length }}
        </span>
      </header>

      <div
        v-for="f in g.facets"
        :key="f.facetId"
        class="relative grid gap-x-6 gap-y-2 border-b border-line px-4 py-3.5 transition-colors last:border-b-0 lg:grid-cols-[220px_1fr_112px]"
        :class="store.focusFacetId === f.facetId ? 'bg-brand-soft/60' : ''"
        @focusin="store.focusFacet(f.facetId)"
      >
        <span v-if="store.focusFacetId === f.facetId" class="absolute inset-y-0 left-0 w-[3px] bg-brand" />

        <!-- Позиция и формат -->
        <div class="flex min-w-0 gap-3">
          <span
            class="code-font grid h-6 w-7 shrink-0 place-items-center rounded-sm text-[11px] font-bold"
            :class="{
              'bg-brand-dark text-white': state(f) === 'ok',
              'bg-[var(--danger)] text-white': state(f) === 'error',
              'border border-line-strong text-ink-3': state(f) === 'empty',
            }"
          >
            {{ pad(f.index + 1) }}
          </span>
          <div class="min-w-0">
            <div class="text-sm font-semibold leading-5 text-ink">
              {{ f.label }}<span v-if="f.required" class="text-[var(--danger)]"> *</span>
            </div>
            <div class="mt-0.5 text-2xs text-ink-3">{{ format(f) }}</div>
            <div v-if="f.config.description" class="mt-0.5 text-2xs leading-4 text-ink-3">{{ f.config.description }}</div>
            <div
              v-if="f.overriddenFields.length > 0"
              v-tooltip.bottom="ruleDescriptions(f.ruleIds)"
              class="mt-1 inline-flex items-center gap-1 rounded-sm bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-[var(--accent)]"
            >
              <i class="pi pi-link text-[9px]" />зависит от выбора выше
            </div>
          </div>
        </div>

        <!-- Значение -->
        <div :id="facetInputId(f.facetId)" class="min-w-0" :data-testid="`facet-${f.facetId}`">
          <span v-if="props.readonly" class="text-sm text-ink-2">{{ f.options?.find((o) => o.code === f.value)?.name ?? (f.value || '—') }}</span>
          <FacetOptions
            v-else-if="f.options && f.options.length <= TILES_LIMIT"
            :model-value="f.value"
            :options="f.options"
            :label="f.label"
            :invalid="!!fieldError(f)"
            @update:model-value="(v: string) => choose(f, v)"
          />
          <Select
            v-else-if="f.options"
            :model-value="f.value || null"
            :options="f.options"
            option-value="code"
            :option-label="optionLabel"
            :invalid="!!fieldError(f)"
            :aria-label="f.label"
            filter
            show-clear
            placeholder="Выберите по коду или названию"
            class="w-full max-w-md"
            @update:model-value="(v: string | null) => choose(f, v)"
          />
          <InputText
            v-else
            :model-value="f.value"
            :placeholder="f.config.placeholder ? `напр. ${f.config.placeholder}` : ''"
            :invalid="!!fieldError(f)"
            :aria-label="f.label"
            class="code-font w-full max-w-[14rem]"
            @update:model-value="(v) => type(f, v)"
            @keydown.enter.prevent="focusNext(f.facetId)"
          />
          <div v-if="fieldError(f)" class="mt-1.5 flex items-center gap-1 text-xs text-[var(--danger)]"><i class="pi pi-exclamation-circle text-[11px]" />{{ fieldError(f) }}</div>
        </div>

        <!-- Сегмент шифра -->
        <div class="hidden justify-end lg:flex">
          <span
            class="code-font h-8 min-w-[56px] truncate rounded-sm border px-2 text-center text-[15px] font-bold leading-[30px]"
            :class="{
              'border-brand-dark bg-white text-brand-dark': state(f) === 'ok',
              'border-[var(--danger)] text-[var(--danger)]': state(f) === 'error',
              'border-dashed border-line-strong text-line-strong': state(f) === 'empty',
            }"
            :title="`Сегмент шифра: ${f.label}`"
          >
            {{ f.value || '··' }}
          </span>
        </div>
      </div>
    </section>
  </div>
</template>
