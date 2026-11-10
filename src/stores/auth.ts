// Аутентификация и RBAC. Назначения пользователя (роль + область) разворачиваются в «эффективные роли»;
// can / canAccessColumn / canAccessRow — единая точка проверки прав для слоя данных, а НЕ для шаблонов.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { authApi } from '@/api'
import type { AbsenceDto } from '@/api/auth'
import * as rbac from '@/lib/rbac'
import { safeStorage } from '@/lib/storage'
import type { CatalogElement, LoginRequest, PermissionAction, Request, RequestStep, ResourceType, Session } from '@/types'

const TOKEN_KEY = 'mdm.token'

const storage = safeStorage

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(storage()?.getItem(TOKEN_KEY) ?? null)
  const session = ref<Session | null>(null)
  /** Восстановление сессии выполнено (guard ждёт его один раз) */
  const restored = ref(false)

  const user = computed(() => session.value?.user ?? null)
  const assignments = computed(() => session.value?.user.assignments ?? [])
  /** Эффективные роли: права ролей, суженные до области назначения */
  const roles = computed(() => rbac.effectiveRoles(assignments.value, session.value?.roles ?? []))
  const isAdmin = computed(() => rbac.isAdmin(assignments.value))
  const isAuthenticated = computed(() => session.value !== null)
  /** Кого пользователь сейчас замещает */
  const delegations = computed(() => session.value?.delegations ?? [])
  /** Назначения для решения строк заявок: свои и замещаемых */
  const acting = computed(() => rbac.actingAssignments(assignments.value, delegations.value))

  function setSession(s: Session | null): void {
    session.value = s
    token.value = s?.token ?? null
    if (s) storage()?.setItem(TOKEN_KEY, s.token)
    else storage()?.removeItem(TOKEN_KEY)
  }

  async function login(dto: LoginRequest): Promise<void> {
    setSession(await authApi.login(dto))
  }

  /** Поднять сессию по сохранённому токену (после перезагрузки страницы) */
  async function restore(): Promise<void> {
    if (restored.value) return
    try {
      if (token.value) setSession(await authApi.me())
    } catch {
      setSession(null)
    } finally {
      restored.value = true
    }
  }

  async function logout(): Promise<void> {
    try {
      if (token.value) await authApi.logout()
    } finally {
      setSession(null)
    }
  }

  /** Локальный сброс (на 401 из interceptor) */
  const clear = () => setSession(null)

  /* ------------------------------ RBAC ------------------------------ */

  const can = (resource: ResourceType, resourceId: string, action: PermissionAction): boolean =>
    rbac.can(roles.value, resource, resourceId, action)

  const canAny = (resource: ResourceType, action: PermissionAction): boolean => rbac.canAny(roles.value, resource, action)

  /** Право на любые объекты типа — создание новых справочников/классификаторов */
  const canGlobally = (resource: ResourceType, action: PermissionAction): boolean => rbac.canGlobally(roles.value, resource, action)

  const canDecide = (request: Request, step: RequestStep): boolean => rbac.canDecideStep(acting.value, request, step)

  /** За кого пользователь решит строку (id замещаемого) — для подписи кнопки */
  const decidesFor = (request: Request, step: RequestStep): string | undefined =>
    rbac.onBehalfOf(assignments.value, delegations.value, request, step)

  /** Отпуск/командировка: сервер возвращает обновлённую сессию */
  async function setAbsence(dto: AbsenceDto): Promise<void> {
    setSession(await authApi.setAbsence(dto))
  }
  async function clearAbsence(): Promise<void> {
    setSession(await authApi.clearAbsence())
  }

  const canAccessColumn = (catalogId: string, columnId: string): boolean => rbac.canAccessColumn(roles.value, catalogId, columnId)

  const canAccessRow = (catalogId: string, el: CatalogElement): boolean => rbac.canAccessRow(roles.value, catalogId, el)

  const filterColumns = <T extends { id: string }>(catalogId: string, cols: readonly T[]): T[] =>
    rbac.filterColumns(roles.value, catalogId, cols)

  const filterRows = (catalogId: string, rows: readonly CatalogElement[]): CatalogElement[] =>
    rbac.filterRows(roles.value, catalogId, rows)

  return {
    token,
    session,
    restored,
    user,
    roles,
    assignments,
    delegations,
    isAdmin,
    isAuthenticated,
    login,
    restore,
    logout,
    clear,
    can,
    canAny,
    canGlobally,
    canDecide,
    decidesFor,
    setAbsence,
    clearAbsence,
    canAccessColumn,
    canAccessRow,
    filterColumns,
    filterRows,
  }
})
