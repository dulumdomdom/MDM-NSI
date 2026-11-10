// Уведомления в системе: новые строки заявок для модераторов, итог заявки для автора.

import type { IsoDateTime } from './common'

export interface AppNotification {
  id: string
  userId: string
  title: string
  text: string
  /** Куда ведёт уведомление */
  requestId?: string
  createdAt: IsoDateTime
  read: boolean
}
