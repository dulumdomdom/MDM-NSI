<script setup lang="ts">
// Колокольчик уведомлений: новые строки заявок для модераторов, итог заявки для автора.
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Popover from 'primevue/popover'
import { useNotificationStore } from '@/stores/notifications'
import type { AppNotification } from '@/types'

const store = useNotificationStore()
const router = useRouter()
const panel = ref<InstanceType<typeof Popover> | null>(null)

onMounted(store.start)
onUnmounted(store.stop)

const dt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

async function open(n: AppNotification): Promise<void> {
  panel.value?.hide()
  if (!n.read) await store.markRead([n.id])
  if (n.requestId) await router.push({ path: '/requests', query: { id: n.requestId } })
}
</script>

<template>
  <button
    type="button"
    class="relative grid h-8 w-8 place-items-center rounded-md text-ink-2 hover:bg-canvas hover:text-brand-dark"
    :aria-label="`Уведомления: непрочитанных ${store.unread}`"
    data-testid="notifications"
    @click="(e) => panel?.toggle(e)"
  >
    <i class="pi pi-bell" />
    <span
      v-if="store.unread"
      class="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white"
      data-testid="notifications-count"
      >{{ store.unread }}</span
    >
  </button>
  <Popover ref="panel">
    <div class="w-[22rem]">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-bold text-brand-dark">Уведомления</span>
        <button v-if="store.unread" type="button" class="text-xs font-medium text-brand hover:underline" @click="store.markRead()">Прочитать все</button>
      </div>
      <p v-if="store.items.length === 0" class="py-6 text-center text-sm text-ink-3">Уведомлений нет</p>
      <ul class="flex max-h-[24rem] flex-col overflow-auto">
        <li v-for="n in store.items" :key="n.id">
          <button type="button" class="flex w-full gap-3 rounded-md px-2 py-2.5 text-left hover:bg-canvas" @click="open(n)">
            <i class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="n.read ? 'bg-transparent' : 'bg-brand'" />
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-ink">{{ n.title }}</span>
              <span class="block text-xs text-ink-2">{{ n.text }}</span>
              <span class="block text-2xs text-ink-3">{{ dt.format(new Date(n.createdAt)) }}</span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </Popover>
</template>
