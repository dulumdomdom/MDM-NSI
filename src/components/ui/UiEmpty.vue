<script setup lang="ts">
// Пустое состояние списка — одна строка текста, без декора.
defineProps<{ text?: string; icon?: string }>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 py-10 text-sm text-ink-3">
    <span>{{ text ?? 'Нет данных' }}</span>
    <slot />
  </div>
</template>
