<script setup lang="ts">
// Ссылка на элемент другого справочника — денормализованная подпись.
import { computed } from 'vue'
import { isReferenceValue } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{ attribute: CatalogAttribute; value: AttributeValue | undefined }>()
const reference = computed(() => (isReferenceValue(props.value) ? props.value : null))
</script>

<template>
  <span v-if="reference" class="inline-flex items-center gap-1 rounded bg-brand-light/50 px-2 py-0.5 text-xs font-medium text-brand-dark">
    <i class="pi pi-link text-[10px]" />{{ reference.display }}
  </span>
</template>
