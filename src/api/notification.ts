// Контракты: уведомления пользователя.

import type { AppNotification } from '@/types'
import { api } from './client'
import { endpoints } from './endpoints'

export const notificationApi = {
  list: () => api.get<AppNotification[]>(endpoints.notifications.list),
  /** Без ids — отметить прочитанными все */
  markRead: (ids?: string[]) => api.post<void>(endpoints.notifications.read, ids ? { ids } : {}),
}
