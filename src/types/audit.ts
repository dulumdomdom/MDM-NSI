// Журнал действий пользователей: кто, что и когда сделал (для администратора и аудитора).

import type { IsoDateTime } from './common'

export type AuditObjectType = 'session' | 'element' | 'catalog' | 'classifier' | 'request' | 'user' | 'role' | 'integration'

export interface AuditEntry {
  id: string
  at: IsoDateTime
  userId: string
  /** Кратко, что сделано: «Изменён элемент», «Строка заявки согласована» */
  action: string
  objectType: AuditObjectType
  objectId?: string
  /** Подпись объекта на момент действия */
  objectName?: string
  details?: string
}
