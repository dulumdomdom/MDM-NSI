<script setup lang="ts">
// Файл: имя и размер. Контент грузится отдельным запросом (в моках не реализован).
import { computed } from 'vue'
import { formatFileSize, isBlobValue } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{ attribute: CatalogAttribute; value: AttributeValue | undefined }>()
const file = computed(() => (isBlobValue(props.value) ? props.value : null))
</script>

<template>
  <span v-if="file" class="inline-flex items-center gap-1 truncate text-brand" :title="`${file.fileName}, ${formatFileSize(file.size)}`">
    <i class="pi pi-paperclip text-xs" />
    <span class="truncate">{{ file.fileName }}</span>
  </span>
</template>
