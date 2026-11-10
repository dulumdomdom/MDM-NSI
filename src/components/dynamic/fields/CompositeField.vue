<script setup lang="ts">
// Составной тип: набор полей существующих типов (рекурсивно — составной внутри составного).
import { computed, type Component } from 'vue'
import UiField from '@/components/ui/UiField.vue'
import { attributeKind, isCompositeValue, type CompositeValue } from '@/lib/attributes'
import type { AttributeKind, AttributeValue, CatalogAttribute } from '@/types'
import NumberField from './NumberField.vue'
import StringField from './StringField.vue'
import DateTimeField from './DateTimeField.vue'
import BlobField from './BlobField.vue'
import ReferenceField from './ReferenceField.vue'
import CompositeField from './CompositeField.vue'

const props = defineProps<{
  attribute: CatalogAttribute
  modelValue: AttributeValue | undefined
  inputId: string
  invalid?: boolean
  readonly?: boolean
  /** Ошибки вида «address.city» */
  errors?: Record<string, string>
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AttributeValue] }>()

const LOCAL: Record<AttributeKind, Component> = {
  number: NumberField,
  string: StringField,
  datetime: DateTimeField,
  blob: BlobField,
  reference: ReferenceField,
  composite: CompositeField,
}

const value = computed<CompositeValue>(() => (isCompositeValue(props.modelValue) ? props.modelValue : {}))

const setPart = (id: string, v: AttributeValue) => emit('update:modelValue', { ...value.value, [id]: v })
const errorOf = (id: string) => props.errors?.[`${props.attribute.id}.${id}`]
</script>

<template>
  <div class="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-line p-3 sm:grid-cols-2">
    <UiField
      v-for="f in attribute.compositeFields ?? []"
      :key="f.id"
      :label="f.name"
      :for-id="`${inputId}-${f.id}`"
      :required="f.required"
      :error="errorOf(f.id)"
    >
      <component
        :is="LOCAL[attributeKind(f.type)]"
        :attribute="f"
        :model-value="value[f.id]"
        :input-id="`${inputId}-${f.id}`"
        :invalid="!!errorOf(f.id)"
        :readonly="readonly"
        @update:model-value="(v: AttributeValue) => setPart(f.id, v)"
      />
    </UiField>
  </div>
</template>
