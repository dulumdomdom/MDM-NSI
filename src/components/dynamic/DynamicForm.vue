<script setup lang="ts">
// Форма по схеме атрибутов: для каждого атрибута — поле из реестра FIELD_COMPONENTS.
// Модель и валидация — в useDynamicForm; компонент только рендерит.
import UiField from '@/components/ui/UiField.vue'
import { attributeKind } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute } from '@/types'
import { FIELD_COMPONENTS } from './fields'

const props = defineProps<{
  attributes: CatalogAttribute[]
  modelValue: Record<string, AttributeValue>
  errors: Record<string, string>
  readonly?: boolean
  idPrefix?: string
}>()
const emit = defineEmits<{ field: [id: string, value: AttributeValue] }>()

const inputId = (attr: CatalogAttribute) => `${props.idPrefix ?? 'attr'}-${attr.id}`
</script>

<template>
  <form class="grid grid-cols-1 gap-4 md:grid-cols-2" @submit.prevent>
    <UiField
      v-for="attr in attributes"
      :key="attr.id"
      :label="attr.name"
      :for-id="inputId(attr)"
      :required="attr.required"
      :error="errors[attr.id]"
      :class="{ 'md:col-span-2': attr.type === 'composite' }"
    >
      <component
        :is="FIELD_COMPONENTS[attributeKind(attr.type)]"
        :attribute="attr"
        :model-value="modelValue[attr.id]"
        :input-id="inputId(attr)"
        :invalid="!!errors[attr.id]"
        :readonly="readonly"
        :errors="attr.type === 'composite' ? errors : undefined"
        @update:model-value="(v: AttributeValue) => emit('field', attr.id, v)"
      />
    </UiField>
  </form>
</template>
