<script setup lang="ts">
// Поиск: 3 режима (контекстный, неточный, по маске). Ввод с задержкой, чтобы не фильтровать на каждый символ.
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import type { SearchMode } from '@/types'

const props = withDefaults(defineProps<{ query?: string; mode?: SearchMode; debounceMs?: number }>(), {
  query: '',
  mode: 'context',
  debounceMs: 250,
})
const emit = defineEmits<{ search: [query: string, mode: SearchMode] }>()

const MODES: { value: SearchMode; label: string; hint: string }[] = [
  { value: 'context', label: 'Контекст', hint: 'Подстрока в любом поле' },
  { value: 'fuzzy', label: 'Неточный', hint: 'Допускает опечатки' },
  { value: 'mask', label: 'Маска', hint: '* — любые символы, ? — один символ' },
]

const text = ref(props.query)
const mode = ref<SearchMode>(props.mode)
let timer: ReturnType<typeof setTimeout> | undefined

const fire = () => emit('search', text.value, mode.value)

watch(text, () => {
  clearTimeout(timer)
  timer = setTimeout(fire, props.debounceMs)
})
watch(mode, fire)
onBeforeUnmount(() => clearTimeout(timer))

/** «/» — к строке поиска (как в почте и трекерах), если фокус не в поле ввода */
const input = ref<{ $el: HTMLInputElement } | null>(null)
function onSlash(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null
  if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
  if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
  if (document.querySelector('.p-dialog, .p-drawer')) return
  e.preventDefault()
  input.value?.$el.focus()
}
onMounted(() => window.addEventListener('keydown', onSlash))
onBeforeUnmount(() => window.removeEventListener('keydown', onSlash))

const placeholder = () => (mode.value === 'mask' ? 'Напр.: СВ*-6?' : 'Поиск…')
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <IconField class="min-w-[16rem] flex-1">
      <InputIcon class="pi pi-search" />
      <InputText ref="input" v-model="text" :placeholder="placeholder()" fluid aria-label="Строка поиска" data-testid="search-input" class="!pr-10" />
      <kbd class="kbd pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" title="Нажмите «/», чтобы перейти к поиску">/</kbd>
    </IconField>
    <SelectButton v-model="mode" :options="MODES" option-label="label" option-value="value" :allow-empty="false" aria-label="Режим поиска">
      <template #option="{ option }">
        <span v-tooltip.bottom="(option as (typeof MODES)[number]).hint">{{ (option as (typeof MODES)[number]).label }}</span>
      </template>
    </SelectButton>
  </div>
</template>
