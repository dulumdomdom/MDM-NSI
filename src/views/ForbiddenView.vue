<script setup lang="ts">
import UiEmpty from '@/components/ui/UiEmpty.vue'
</script>

<template>
  <UiEmpty icon="pi pi-lock" text="Недостаточно прав для просмотра раздела">
    <router-link to="/" class="text-sm text-brand hover:underline">На главную</router-link>
  </UiEmpty>
</template>
