<script setup lang="ts">
// Редактор условия перехода (12 типов). Разбор ввода — lib/classifier/conditions.
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { CONDITION_TYPES, conditionToInput, parseConditionInput } from '@/lib/classifier'
import type { ConditionType, TransitionCondition } from '@/types'

const props = defineProps<{ modelValue: TransitionCondition | undefined; idPrefix?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: TransitionCondition | undefined] }>()

const type = ref<ConditionType>(props.modelValue?.type ?? 'string')
const text = ref(props.modelValue ? conditionToInput(props.modelValue) : '')
const error = ref('')

// Внешняя смена условия (выбрали другую ноду) — синхронизируем поля
watch(
  () => props.modelValue,
  (c) => {
    type.value = c?.type ?? 'string'
    text.value = c ? conditionToInput(c) : ''
    error.value = ''
  },
)

function apply(): void {
  const res = parseConditionInput(type.value, text.value)
  if (res.ok) {
    error.value = ''
    emit('update:modelValue', res.condition)
  } else {
    error.value = res.error
  }
}

const hint = () => CONDITION_TYPES.find((t) => t.type === type.value)?.hint ?? ''
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex flex-wrap gap-2">
      <Select
        v-model="type"
        :options="CONDITION_TYPES"
        option-label="label"
        option-value="type"
        class="w-56"
        :aria-label="'Тип условия'"
        @change="apply"
      />
      <InputText
        v-model="text"
        :placeholder="hint()"
        class="code-font min-w-0 flex-1"
        :invalid="!!error"
        aria-label="Значение условия"
        @blur="apply"
        @keydown.enter.prevent="apply"
      />
      <Button v-if="modelValue" icon="pi pi-times" severity="secondary" text aria-label="Убрать условие" @click="emit('update:modelValue', undefined)" />
    </div>
    <small v-if="error" class="text-xs text-red-600">{{ error }}</small>
    <small v-else class="text-xs text-ink-3">Диапазон — «min..max», элементы массива — через «;». Пример: {{ hint() }}</small>
  </div>
</template>
