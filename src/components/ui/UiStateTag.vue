<script setup lang="ts">
// Состояние элемента справочника — цвет берётся из конфигурации состояния.
import { computed } from 'vue'
import Tag from 'primevue/tag'
import type { CatalogState } from '@/types'

const props = defineProps<{ stateId: string; states: CatalogState[] }>()
const state = computed(() => props.states.find((s) => s.id === props.stateId))
</script>

<template>
  <Tag :value="state?.name ?? stateId" :severity="state?.color ?? 'secondary'" />
</template>
