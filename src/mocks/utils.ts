// Общие помощники обработчиков MSW: авторизация по токену, ответы-ошибки, задержка.

import { delay, HttpResponse } from 'msw'
import { actingAssignments, can, canGlobally, delegationsOf, effectiveRoles, isAdmin } from '@/lib/rbac'
import type { ApiErrorBody, Delegation, PermissionAction, ResourceType, RoleAssignment, User } from '@/types'
import { db } from './db'

/** Токен мока — без состояния: переживает перезагрузку страницы */
export const makeToken = (userId: string): string => `mock.${btoa(userId)}`

export function userFromRequest(request: Request): User | null {
  const header = request.headers.get('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token.startsWith('mock.')) return null
  try {
    const id = atob(token.slice(5))
    return db.users.find((u) => u.id === id && u.status === 'active') ?? null
  } catch {
    return null
  }
}

export function apiError(status: number, code: string, message: string, details?: Record<string, string>) {
  const body: ApiErrorBody = { code, message, ...(details ? { details } : {}) }
  return HttpResponse.json(body, { status })
}

export const unauthorized = () => apiError(401, 'UNAUTHORIZED', 'Требуется вход в систему')
export const notFound = (what: string) => apiError(404, 'NOT_FOUND', `${what} не найден(а)`)
export const forbidden = (what = 'Недостаточно прав') => apiError(403, 'FORBIDDEN', what)

/** Проверка прав «как на сервере» — те же правила, что и на клиенте (lib/rbac) */
export function userCan(user: User, resource: ResourceType, resourceId: string, action: PermissionAction): boolean {
  return can(effectiveRoles(user.assignments, db.roles), resource, resourceId, action)
}

/** Право на объекты любого id (создание новых справочников/классификаторов) */
export function userCanGlobally(user: User, resource: ResourceType, action: PermissionAction): boolean {
  return canGlobally(effectiveRoles(user.assignments, db.roles), resource, action)
}

export const userIsAdmin = (user: User): boolean => isAdmin(user.assignments)

/** С какими назначениями пользователь действует сейчас: свои и тех, кого замещает */
export function acting(user: User): { delegations: Delegation[]; assignments: RoleAssignment[] } {
  const delegations = delegationsOf(user.id, db.users)
  return { delegations, assignments: actingAssignments(user.assignments, delegations) }
}

/** Реалистичная сетевая задержка (в тестах MSW можно отключить через MOCK_DELAY=0) */
export const latency = () => delay(import.meta.env.MODE === 'test' ? 0 : 150)
