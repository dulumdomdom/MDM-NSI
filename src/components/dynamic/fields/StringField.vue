<script setup lang="ts">
import InputText from 'primevue/inputtext'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{
  attribute: CatalogAttribute
  modelValue: AttributeValue | undefined
  inputId: string
  invalid?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AttributeValue] }>()

const onInput = (v: string | undefined) => emit('update:modelValue', v ? v : null)
</script>

<template>
  <InputText
    :id="inputId"
    :model-value="typeof props.modelValue === 'string' ? props.modelValue : ''"
    :maxlength="attribute.maxLength"
    :invalid="invalid"
    :readonly="readonly"
    fluid
    @update:model-value="onInput"
  />
</template>
