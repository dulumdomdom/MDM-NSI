<script setup lang="ts">
import ReferencePicker from '../ReferencePicker.vue'
import { isReferenceValue } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute, ReferenceValue } from '@/types'

const props = defineProps<{
  attribute: CatalogAttribute
  modelValue: AttributeValue | undefined
  inputId: string
  invalid?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AttributeValue] }>()

const onInput = (v: ReferenceValue | null) => emit('update:modelValue', v)
</script>

<template>
  <ReferencePicker
    :input-id="inputId"
    :catalog-id="attribute.referenceCatalogId ?? ''"
    :display-attribute-id="attribute.referenceDisplayAttributeId"
    :model-value="isReferenceValue(props.modelValue) ? props.modelValue : null"
    :invalid="invalid"
    :disabled="readonly"
    @update:model-value="onInput"
  />
</template>
