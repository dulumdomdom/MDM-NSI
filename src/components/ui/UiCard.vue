<script setup lang="ts">
// Панель: тонкая рамка, без теней. Заголовок отделён линией.
// flush — без внутренних отступов (таблицы/списки во всю ширину).
defineProps<{ title?: string; icon?: string; flush?: boolean; interactive?: boolean }>()
</script>

<template>
  <section class="rounded-lg border border-line bg-white" :class="interactive ? 'transition-colors hover:border-line-strong' : ''">
    <header v-if="title || $slots.actions" class="flex h-11 items-center justify-between gap-2 border-b border-line px-4">
      <h2 class="text-sm font-bold text-brand-dark">{{ title }}</h2>
      <slot name="actions" />
    </header>
    <div :class="flush ? '' : 'p-4'">
      <slot />
    </div>
  </section>
</template>
