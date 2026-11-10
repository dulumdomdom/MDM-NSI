<script setup lang="ts">
// Составной тип: значения полей через запятую.
import { computed } from 'vue'
import { formatAttribute } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{ attribute: CatalogAttribute; value: AttributeValue | undefined }>()
const text = computed(() => formatAttribute(props.attribute, props.value))
</script>

<template>
  <span class="block truncate text-ink-2" :title="text">{{ text }}</span>
</template>
