<script setup lang="ts">
// Шифры элемента по привязанным классификаторам: статус согласования, присвоить / изменить / снять.
import Button from 'primevue/button'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import type { CatalogElement, ClassifierBinding, ElementCodeStatus } from '@/types'

const props = defineProps<{
  element: CatalogElement
  bindings: ClassifierBinding[]
  classifierName: (id: string) => string
  canEdit: boolean
}>()
const emit = defineEmits<{ assign: [binding: ClassifierBinding]; remove: [classifierId: string] }>()

const STATUS: Record<ElementCodeStatus, { label: string; cls: string }> = {
  approved: { label: 'Утверждён', cls: 'bg-emerald-50 text-emerald-700' },
  on_approval: { label: 'На согласовании', cls: 'bg-brand-soft text-brand-dark' },
  rejected: { label: 'Отклонён', cls: 'bg-red-50 text-red-700' },
}

const codeOf = (classifierId: string) => props.element.codes?.find((c) => c.classifierId === classifierId)
</script>

<template>
  <div>
    <UiEmpty v-if="props.bindings.length === 0" text="К справочнику не привязаны классификаторы — настройте во вкладке «Классификаторы»" />
    <div v-for="b in props.bindings" :key="b.classifierId" class="border-b border-line py-3.5 last:border-b-0" :data-testid="`element-code-${b.classifierId}`">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 text-sm font-semibold text-ink">
            {{ props.classifierName(b.classifierId) }}
            <span v-if="b.required && !codeOf(b.classifierId)" class="rounded bg-red-50 px-1.5 py-0.5 text-2xs font-semibold text-red-700">обязателен</span>
          </div>
          <template v-if="codeOf(b.classifierId)">
            <div class="code-font mt-1.5 text-lg font-semibold tracking-wide text-brand-dark">{{ codeOf(b.classifierId)?.code }}</div>
            <div class="mt-0.5 text-sm text-ink-2">{{ codeOf(b.classifierId)?.decoded }}</div>
          </template>
          <div v-else class="mt-1 text-sm text-ink-3">Шифр не присвоен</div>
        </div>
        <div class="flex items-center gap-2">
          <span v-if="codeOf(b.classifierId)" class="rounded px-2 py-0.5 text-xs font-semibold" :class="STATUS[codeOf(b.classifierId)!.status].cls">
            {{ STATUS[codeOf(b.classifierId)!.status].label }}
          </span>
          <template v-if="props.canEdit">
            <Button
              :label="codeOf(b.classifierId) ? 'Изменить' : 'Присвоить шифр'"
              :icon="codeOf(b.classifierId) ? 'pi pi-pencil' : 'pi pi-plus'"
              size="small"
              :outlined="!!codeOf(b.classifierId)"
              :data-testid="`assign-${b.classifierId}`"
              @click="emit('assign', b)"
            />
            <Button
              v-if="codeOf(b.classifierId)"
              v-tooltip.top="'Снять шифр'"
              icon="pi pi-times"
              text
              rounded
              size="small"
              severity="secondary"
              aria-label="Снять шифр"
              @click="emit('remove', b.classifierId)"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
