// Уведомления пользователя: колокольчик в шапке. Опрос раз в 30 секунд, пока пользователь в системе.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { notificationApi } from '@/api'
import type { AppNotification } from '@/types'

const POLL_MS = 30_000

export const useNotificationStore = defineStore('notifications', () => {
  const items = ref<AppNotification[]>([])
  const unread = computed(() => items.value.filter((n) => !n.read).length)
  let timer: ReturnType<typeof setInterval> | undefined

  async function load(): Promise<void> {
    try {
      items.value = await notificationApi.list()
    } catch {
      /* фоновое обновление — ошибки не показываем */
    }
  }

  function start(): void {
    stop()
    void load()
    timer = setInterval(() => void load(), POLL_MS)
  }

  function stop(): void {
    if (timer) clearInterval(timer)
    timer = undefined
  }

  async function markRead(ids?: string[]): Promise<void> {
    items.value = items.value.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n))
    await notificationApi.markRead(ids)
  }

  return { items, unread, load, start, stop, markRead }
})
