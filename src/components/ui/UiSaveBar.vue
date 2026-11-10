<script setup lang="ts">
// Плашка несохранённых изменений конфигурации: закреплена внизу листа, показывает ошибки проверки.
import Button from 'primevue/button'

defineProps<{ dirty: boolean; saving?: boolean; issues: { where: string; message: string }[] }>()
const emit = defineEmits<{ save: []; discard: [] }>()
</script>

<template>
  <div v-if="dirty || issues.length" class="sticky bottom-0 z-10 -mx-8 mt-6 border-t border-line bg-white/95 px-8 py-3 backdrop-blur">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0 text-sm">
        <span v-if="issues.length" v-tooltip.top="issues.map((i) => `${i.where}: ${i.message}`).join('\n')" class="font-medium text-[var(--danger)]">
          <i class="pi pi-exclamation-circle mr-1 text-xs" />Ошибок в конфигурации: {{ issues.length }} — {{ issues[0]?.where }}: {{ issues[0]?.message }}
        </span>
        <span v-else class="text-ink-2"><i class="pi pi-circle-fill mr-1.5 text-[7px] text-[var(--accent)]" />Есть несохранённые изменения</span>
      </div>
      <div class="flex gap-2">
        <Button label="Отменить" severity="secondary" text :disabled="!dirty" @click="emit('discard')" />
        <Button label="Сохранить" icon="pi pi-check" :disabled="!dirty || issues.length > 0" :loading="saving" data-testid="config-save" @click="emit('save')" />
      </div>
    </div>
  </div>
</template>
