<script setup lang="ts">
// Поле шифра: пользователь печатает строку целиком (режим direct), а фасеты подсвечиваются прямо под текстом.
// Техника: прозрачный текст в <input> поверх слоя разметки CodePreview с той же метрикой шрифта.
// Если direct не разрешён конфигом — поле только показывает шифр, собранный из фасетов.
import { computed, nextTick, ref } from 'vue'
import CodePreview from './CodePreview.vue'
import { useClassifier } from '@/composables/useClassifier'

const props = defineProps<{ editable: boolean }>()

const { store, facetAt } = useClassifier()

const input = ref<HTMLInputElement | null>(null)
const offsetX = ref(0)

const rtl = computed(() => store.classifier?.readDirection === 'rtl')
const filled = computed(() => store.visibleFacets.filter((f) => f.value !== '').length)
/** Первая содержательная ошибка (пустые обязательные фасеты видны в списке ниже) */
const firstError = computed(() => store.issues.find((i) => !['empty', 'required'].includes(i.code)))
const missing = computed(() => store.issues.filter((i) => i.code === 'required').length)

function syncScroll(): void {
  offsetX.value = input.value?.scrollLeft ?? 0
}

function onInput(e: Event): void {
  store.setCode((e.target as HTMLInputElement).value)
  void nextTick(syncScroll)
}

/** Каретка в поле → подсветка фасета под ней (и строки в списке фасетов) */
function onCaret(): void {
  syncScroll()
  const pos = input.value?.selectionStart
  if (pos === null || pos === undefined) return
  store.focusFacet(facetAt(pos)?.facetId ?? null)
}
</script>

<template>
  <div>
    <div class="code-box relative overflow-hidden rounded-lg border-2 transition-colors" :class="props.editable ? 'border-brand/40 focus-within:border-brand' : 'border-line bg-canvas/50'">
      <div class="code-font pointer-events-none absolute inset-0 px-4 pt-[10px] text-[26px] leading-[40px] [&_.seg]:pointer-events-auto">
        <CodePreview :offset-x="offsetX" />
      </div>
      <input
        id="code-input"
        ref="input"
        :value="store.inputCode"
        :readonly="!props.editable"
        class="code-font relative w-full bg-transparent px-4 pt-[10px] text-[26px] leading-[40px] text-transparent caret-brand-dark outline-none selection:bg-brand-light/70 placeholder:font-sans placeholder:text-base placeholder:text-ink-3"
        :placeholder="props.editable ? 'Введите шифр или заполните фасеты ниже' : 'Заполните фасеты ниже'"
        autocomplete="off"
        spellcheck="false"
        aria-label="Шифр"
        data-testid="code-input"
        @input="onInput"
        @scroll="syncScroll"
        @keyup="onCaret"
        @click="onCaret"
        @focus="onCaret"
      />
      <!-- Полоса под текстом — место для номеров фасетов -->
      <div class="h-7" />
    </div>

    <div class="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
      <span class="text-ink-3">
        <template v-if="rtl">Читается справа налево · </template>
        заполнено <b class="text-brand-dark">{{ filled }}</b> из {{ store.visibleFacets.length }}
        <template v-if="missing > 0"> · не хватает обязательных: {{ missing }}</template>
      </span>
      <span v-if="store.inputCode && firstError" class="text-[var(--danger)]">{{ firstError.message }}</span>
      <span v-else-if="store.canSubmit" class="font-semibold text-emerald-700"><i class="pi pi-check mr-1 text-[10px]" />Шифр корректен</span>
    </div>
  </div>
</template>
