<script setup lang="ts">
// Обёртка поля формы: подпись, признак обязательности, подсказка и ошибка.
defineProps<{ label: string; forId?: string; required?: boolean; error?: string; hint?: string }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="forId" class="flex items-center gap-1 text-sm font-medium text-ink-2">
      {{ label }}
      <span v-if="required" class="text-red-600" aria-hidden="true">*</span>
      <slot name="badge" />
    </label>
    <slot />
    <small v-if="error" class="text-xs text-red-600">{{ error }}</small>
    <small v-else-if="hint" class="text-xs text-ink-3">{{ hint }}</small>
  </div>
</template>
