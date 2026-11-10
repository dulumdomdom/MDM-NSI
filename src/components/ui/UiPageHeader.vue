<script setup lang="ts">
// Заголовок страницы: название, подзаголовок, слот над заголовком (метки/крошки) и действия справа.
// icon оставлен для совместимости вызовов, но не рисуется — заголовок держится на типографике.
defineProps<{ title: string; subtitle?: string; icon?: string }>()
</script>

<template>
  <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <slot name="breadcrumbs" />
      <h1 class="truncate text-[26px] font-extrabold leading-8 tracking-[-0.02em] text-brand-dark">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-ink-2">{{ subtitle }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
