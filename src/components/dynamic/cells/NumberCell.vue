<script setup lang="ts">
import { computed } from 'vue'
import { formatAttribute } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{ attribute: CatalogAttribute; value: AttributeValue | undefined }>()
const text = computed(() => formatAttribute(props.attribute, props.value))
</script>

<template>
  <span class="block text-right tabular-nums">{{ text }}</span>
</template>
