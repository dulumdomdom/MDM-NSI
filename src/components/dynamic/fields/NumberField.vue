<script setup lang="ts">
import InputNumber from 'primevue/inputnumber'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{
  attribute: CatalogAttribute
  modelValue: AttributeValue | undefined
  inputId: string
  invalid?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AttributeValue] }>()

const onInput = (v: number | null | undefined) => emit('update:modelValue', v ?? null)
</script>

<template>
  <InputNumber
    :input-id="inputId"
    :model-value="typeof props.modelValue === 'number' ? props.modelValue : null"
    :min-fraction-digits="0"
    :max-fraction-digits="attribute.type === 'int' ? 0 : 6"
    :min="attribute.min"
    :max="attribute.max"
    :use-grouping="false"
    locale="ru-RU"
    :invalid="invalid"
    :readonly="readonly"
    fluid
    @update:model-value="onInput"
  />
</template>
