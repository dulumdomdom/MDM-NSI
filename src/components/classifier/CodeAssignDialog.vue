<script setup lang="ts">
// Присвоение шифра элементу справочника из карточки (модератор/администратор).
// Подбор шифра — CodePickerDialog; здесь — что делать с шифром: присвоить и при желании переименовать элемент.
import { computed } from 'vue'
import CodePickerDialog from './CodePickerDialog.vue'
import { textOf } from '@/lib/attributes'
import { useCatalogStore } from '@/stores/catalog'
import type { CatalogElement, ClassifierBinding, StepCode } from '@/types'

const props = defineProps<{ element: CatalogElement | null; binding: ClassifierBinding | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ assigned: [element: CatalogElement] }>()

const catalogStore = useCatalogStore()

const displayAttr = computed(() => catalogStore.currentCatalog?.displayAttributeId ?? 'name')
const elementName = computed(() => (props.element ? textOf(props.element.attributes[displayAttr.value], props.element.id) : ''))
const existing = computed(() => props.element?.codes?.find((c) => c.classifierId === props.binding?.classifierId))

async function pick(code: StepCode, useAsName: boolean): Promise<string | null> {
  const el = props.element
  if (!el) return 'Элемент не выбран'
  const res = await catalogStore.assignCode(el.id, code)
  if (typeof res === 'string') return res
  // Наименование элемента — из краткого наименования шифра (если выбрано)
  if (useAsName) {
    await catalogStore.saveElement(
      { attributes: { ...res.element.attributes, [displayAttr.value]: code.shortName }, state: res.element.state, ...(res.element.parentId ? { parentId: res.element.parentId } : {}) },
      res.element.id,
    )
  }
  emit('assigned', res.element)
  return null
}
</script>

<template>
  <CodePickerDialog
    v-model:visible="visible"
    :classifier-id="props.binding?.classifierId ?? null"
    :subject="elementName"
    :catalog-id="existing?.catalogId ?? props.binding?.classifierCatalogId"
    :lock-catalog="!!props.binding?.classifierCatalogId"
    :initial-code="existing?.code"
    :suggest-name="props.binding?.suggestName"
    :pick="pick"
  />
</template>
