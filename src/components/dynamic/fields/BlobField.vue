<script setup lang="ts">
// Файл (BLOB): выбор файла → метаданные в модели.
// Загрузка содержимого — отдельный эндпоинт, добавить вместе с реальным API.
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import { formatFileSize, isBlobValue } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute } from '@/types'

const props = defineProps<{
  attribute: CatalogAttribute
  modelValue: AttributeValue | undefined
  inputId: string
  invalid?: boolean
  readonly?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: AttributeValue] }>()

const input = ref<HTMLInputElement | null>(null)
const file = computed(() => (isBlobValue(props.modelValue) ? props.modelValue : null))

function onChange(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) emit('update:modelValue', { fileName: f.name, size: f.size, mimeType: f.type || 'application/octet-stream' })
}
</script>

<template>
  <div class="flex items-center gap-2" :class="{ 'rounded-md ring-1 ring-red-500': invalid }">
    <input :id="inputId" ref="input" type="file" class="hidden" @change="onChange" />
    <Button v-if="!readonly" label="Выбрать файл" icon="pi pi-upload" size="small" outlined @click="input?.click()" />
    <span v-if="file" class="truncate text-sm">{{ file.fileName }} · {{ formatFileSize(file.size) }}</span>
    <span v-else class="text-sm text-ink-3">Файл не выбран</span>
    <Button
      v-if="file && !readonly"
      icon="pi pi-times"
      text
      rounded
      size="small"
      severity="secondary"
      aria-label="Убрать файл"
      @click="emit('update:modelValue', null)"
    />
  </div>
</template>
