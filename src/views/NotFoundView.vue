<script setup lang="ts">
import UiEmpty from '@/components/ui/UiEmpty.vue'
</script>

<template>
  <div class="flex h-full items-center justify-center">
    <UiEmpty icon="pi pi-compass" text="Страница не найдена">
      <router-link to="/" class="text-sm text-brand hover:underline">На главную</router-link>
    </UiEmpty>
  </div>
</template>
