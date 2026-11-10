// Журнал действий «сервера»: каждое изменяющее действие пишет запись (кто, что, над чем).

import type { AuditEntry, AuditObjectType, User } from '@/types'
import { db, nextId, nowIso } from './db'

export function audit(user: Pick<User, 'id'>, action: string, objectType: AuditObjectType, objectId?: string, objectName?: string, details?: string): void {
  const entry: AuditEntry = {
    id: nextId('au'),
    at: nowIso(),
    userId: user.id,
    action,
    objectType,
    ...(objectId ? { objectId } : {}),
    ...(objectName ? { objectName } : {}),
    ...(details ? { details } : {}),
  }
  db.audit.unshift(entry)
  // Мок держит последние 2000 записей
  if (db.audit.length > 2000) db.audit.length = 2000
}
