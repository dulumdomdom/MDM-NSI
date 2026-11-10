// UI-состояние: сайдбар и очередь уведомлений. Store'ы кладут сюда сообщения,
// App.vue показывает их через PrimeVue Toast — store'ы не зависят от UI-библиотеки.

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { safeStorage } from '@/lib/storage'

export type Severity = 'success' | 'info' | 'warn' | 'error'

export interface Notification {
  id: number
  severity: Severity
  summary: string
  detail?: string
}

const SIDEBAR_KEY = 'mdm.sidebarCollapsed'

const readFlag = (key: string): boolean => safeStorage()?.getItem(key) === '1'

export const useUiStore = defineStore('ui', () => {
  const sidebarCollapsed = ref(readFlag(SIDEBAR_KEY))
  const notifications = ref<Notification[]>([])
  let seq = 0

  watch(sidebarCollapsed, (v) => {
    safeStorage()?.setItem(SIDEBAR_KEY, v ? '1' : '0')
  })

  function notify(severity: Severity, summary: string, detail?: string): void {
    notifications.value.push({ id: ++seq, severity, summary, ...(detail ? { detail } : {}) })
  }

  /** Забрать накопленные уведомления (вызывает App.vue) */
  function drain(): Notification[] {
    const out = notifications.value
    notifications.value = []
    return out
  }

  const toggleSidebar = () => (sidebarCollapsed.value = !sidebarCollapsed.value)

  return { sidebarCollapsed, notifications, notify, drain, toggleSidebar }
})
