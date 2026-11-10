<script setup lang="ts">
// Live-превью шифра: слой разметки, который лежит ПОД прозрачным текстом поля ввода (CodeInput).
// Каждый фасет подчёркнут: синим — заполнен, янтарным — изменён зависимостью, красным — ошибка.
// Под сегментом — номер фасета; клик по номеру → фокус на поле фасета.
// Номера рисуются псевдоэлементами, поэтому textContent слоя = ровно шифр (без отступов, чтобы
// символы совпадали с текстом поля посимвольно).
import { useClassifier } from '@/composables/useClassifier'
import type { ParsedFacet } from '@/lib/classifier'

defineProps<{ offsetX: number }>()

const { store, segments, focusField } = useClassifier()

function segClass(f: ParsedFacet): string {
  const focused = store.focusFacetId === f.facetId ? ' seg-focused' : ''
  if (f.issues.length > 0) return `seg-error${focused}`
  if (f.overriddenFields.length > 0) return `seg-dep${focused}`
  return `seg-ok${focused}`
}
</script>

<template>
  <div class="layer" :style="{ transform: `translateX(${-offsetX}px)` }" aria-hidden="true" data-testid="preview-code">
    <template v-for="(s, i) in segments" :key="i">
      <span
        v-if="s.kind === 'facet' && s.text !== ''"
        class="seg"
        :class="segClass(s.facet)"
        :data-index="s.facet.index + 1"
        :title="s.facet.label"
        :data-testid="`chip-${s.facet.facetId}`"
        @click="focusField(s.facet.facetId)"
        >{{ s.text }}</span
      ><span v-else-if="s.kind === 'sep'" class="text-brand/50">{{ s.text }}</span
      ><span v-else-if="s.kind === 'rest'" class="seg-rest">{{ s.text }}</span>
    </template>
  </div>
</template>

<style scoped>
.layer {
  white-space: pre;
  color: var(--brand-dark);
}
.seg {
  position: relative;
  cursor: pointer;
  border-bottom: 3px solid;
  border-radius: 2px;
}
.seg-ok {
  border-color: var(--brand);
}
.seg-dep {
  border-color: var(--accent);
}
.seg-error {
  border-color: var(--danger);
  color: var(--danger);
}
.seg-focused {
  background: var(--brand-light);
}
/* Номер фасета под сегментом — кликабелен, т.к. лежит ниже поля ввода */
.seg::after {
  content: attr(data-index);
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 16px;
  padding: 2px 3px;
  border-radius: 4px;
  font: 700 10px/1 'Manrope Variable', Manrope, sans-serif;
  letter-spacing: 0;
  text-align: center;
  color: var(--brand-dark);
  background: var(--brand-soft);
}
.seg-focused::after {
  color: #fff;
  background: var(--brand);
}
.seg-rest {
  color: var(--danger);
  text-decoration: underline wavy;
  text-underline-offset: 6px;
}
</style>
