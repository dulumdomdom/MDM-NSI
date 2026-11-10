<script setup lang="ts">
// Выбор элемента другого справочника. Варианты грузит catalog store (с учётом RBAC целевого справочника).
import { onMounted, ref, watch } from 'vue'
import Select from 'primevue/select'
import { useCatalogStore } from '@/stores/catalog'
import type { ReferenceValue } from '@/types'

const props = defineProps<{
  catalogId: string
  displayAttributeId?: string
  modelValue: ReferenceValue | null
  inputId?: string
  invalid?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: ReferenceValue | null] }>()

const store = useCatalogStore()
const options = ref<ReferenceValue[]>([])
const loading = ref(false)

async function load(): Promise<void> {
  if (!props.catalogId) return
  loading.value = true
  try {
    options.value = await store.referenceOptions(props.catalogId, props.displayAttributeId)
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.catalogId, load)

function onChange(id: string | null): void {
  emit('update:modelValue', options.value.find((o) => o.elementId === id) ?? null)
}
</script>

<template>
  <Select
    :input-id="inputId"
    :model-value="modelValue?.elementId ?? null"
    :options="options"
    option-label="display"
    option-value="elementId"
    :loading="loading"
    :invalid="invalid"
    :disabled="disabled"
    filter
    show-clear
    placeholder="Выберите…"
    fluid
    @update:model-value="onChange"
  />
</template>
