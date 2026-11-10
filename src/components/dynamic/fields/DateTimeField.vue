<script setup lang="ts">
// Дата-время: в модели — ISO-строка, в DatePicker — Date.
import { computed } from 'vue'
import DatePicker from 'primevue/datepicker'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{
  attribute: CatalogAttribute
  modelValue: AttributeValue | undefined
  inputId: string
  invalid?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AttributeValue] }>()

const date = computed(() => (typeof props.modelValue === 'string' && props.modelValue ? new Date(props.modelValue) : null))

function onInput(v: Date | Date[] | (Date | null)[] | null | undefined): void {
  emit('update:modelValue', v instanceof Date ? v.toISOString() : null)
}
</script>

<template>
  <DatePicker
    :input-id="inputId"
    :model-value="date"
    show-time
    hour-format="24"
    date-format="dd.mm.yy"
    show-icon
    show-button-bar
    :invalid="invalid"
    :disabled="readonly"
    fluid
    @update:model-value="onInput"
  />
</template>
