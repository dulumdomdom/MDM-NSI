<script setup lang="ts">
// Значения фасета плитками «код + наименование», как в печатном классификаторе.
// Клавиатура: стрелки — по плиткам, Enter/пробел — выбрать, набор кода (буквы/цифры) — выбрать по коду.
import { computed, ref } from 'vue'
import type { CodeName } from '@/types'

const props = defineProps<{ options: CodeName[]; modelValue: string; label: string; invalid?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const root = ref<HTMLElement | null>(null)
const plain = (o: CodeName) => o.name === o.code
/** Подпись для скринридера и тестов: «SV — Сверло» */
const aria = (o: CodeName) => (plain(o) ? o.code : `${o.code} — ${o.name}`)
/** Короткие коды без названий — компактной строкой */
const compact = computed(() => props.options.every(plain))

let typed = ''
let typedAt = 0

const buttons = () => Array.from(root.value?.querySelectorAll<HTMLButtonElement>('button[role=radio]') ?? [])

function select(code: string): void {
  emit('update:modelValue', code === props.modelValue ? '' : code)
}

function onKey(e: KeyboardEvent, i: number): void {
  const list = buttons()
  const move = (d: number) => list[(i + d + list.length) % list.length]?.focus()
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') return (e.preventDefault(), move(1))
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') return (e.preventDefault(), move(-1))
  if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey || e.key === ' ') return
  // Набор кода: символы, введённые быстрее 0,8 с, копятся («1», «12»)
  const now = Date.now()
  typed = (now - typedAt < 800 ? typed : '') + e.key.toUpperCase()
  typedAt = now
  const exact = props.options.find((o) => o.code.toUpperCase() === typed)
  const prefix = props.options.filter((o) => o.code.toUpperCase().startsWith(typed))
  if (exact && prefix.length === 1) {
    e.preventDefault()
    emit('update:modelValue', exact.code)
  } else if (prefix[0]) {
    list[props.options.indexOf(prefix[0])]?.focus()
  }
}
</script>

<template>
  <div
    ref="root"
    role="radiogroup"
    :aria-label="props.label"
    class="grid gap-1.5"
    :class="compact ? 'grid-cols-[repeat(auto-fill,minmax(64px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(168px,1fr))]'"
  >
    <button
      v-for="(o, i) in props.options"
      :key="o.code"
      type="button"
      role="radio"
      :aria-checked="o.code === props.modelValue"
      :aria-label="aria(o)"
      :tabindex="o.code === props.modelValue || (!props.modelValue && i === 0) ? 0 : -1"
      class="opt group relative flex min-h-[44px] items-start gap-2.5 rounded border px-2.5 py-2 text-left outline-none transition-colors"
      :class="[
        o.code === props.modelValue ? 'opt-on' : 'opt-off',
        props.invalid && o.code !== props.modelValue ? 'border-red-300' : '',
        compact ? 'justify-center' : '',
      ]"
      @click="select(o.code)"
      @keydown="onKey($event, i)"
    >
      <span class="code-font shrink-0 text-[15px] font-bold leading-5" :class="o.code === props.modelValue ? 'text-white' : 'text-brand-dark'">{{ o.code }}</span>
      <span v-if="!plain(o)" class="line-clamp-2 text-[12.5px] leading-[17px]" :class="o.code === props.modelValue ? 'text-white/90' : 'text-ink-2'">{{ o.name }}</span>
    </button>
  </div>
</template>

<style scoped>
.opt-off {
  border-color: var(--border);
  background: #fff;
}
.opt-off:hover {
  border-color: var(--brand);
  background: var(--brand-soft);
}
.opt-on {
  border-color: var(--brand-dark);
  background: var(--brand-dark);
}
.opt:focus-visible {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--brand);
}
</style>
