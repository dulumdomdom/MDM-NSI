<script setup lang="ts">
// Корень: глобальные Toast/ConfirmDialog и вывод уведомлений из ui store.
import { watch } from 'vue'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import { useToast } from 'primevue/usetoast'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const toast = useToast()

watch(
  () => ui.notifications.length,
  (n) => {
    if (n === 0) return
    for (const m of ui.drain()) toast.add({ severity: m.severity, summary: m.summary, detail: m.detail, life: 4000 })
  },
)
</script>

<template>
  <Toast position="top-right" />
  <ConfirmDialog />
  <router-view />
</template>
