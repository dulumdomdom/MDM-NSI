// Администрирование: пользователи (CRUD, назначения ролей по областям), роли (CRUD), парольная политика,
// смена своего пароля.

import { computed, ref } from 'vue'
import { adminApi, authApi, catalogApi, classifierApi, errorMessage } from '@/api'
import type { CreateUserDto } from '@/api/auth'
import { scopeLabel } from '@/lib/rbac'
import { validatePassword } from '@/lib/security/password'
import { useUiStore } from '@/stores/ui'
import type { CatalogSummary, ClassifierSummary, PasswordPolicy, Role, RoleScope, User, UserStatus } from '@/types'

export interface ScopeOption {
  key: string
  label: string
  group: string
  scope: RoleScope
}

export const scopeKey = (s: RoleScope): string => (s.type === 'global' ? 'global' : `${s.type}:${s.id}`)

export function useAdmin() {
  const ui = useUiStore()
  const users = ref<User[]>([])
  const roles = ref<Role[]>([])
  const policy = ref<PasswordPolicy | null>(null)
  const catalogs = ref<CatalogSummary[]>([])
  const classifiers = ref<ClassifierSummary[]>([])
  const loading = ref(false)

  const roleName = computed(() => {
    const map = new Map(roles.value.map((r) => [r.id, r.name]))
    return (id: string) => map.get(id) ?? id
  })

  /** Имена объектов для подписей областей */
  const objectNames = computed<Record<string, string>>(() =>
    Object.fromEntries([...catalogs.value, ...classifiers.value].map((x) => [x.id, x.name])),
  )
  const scopeText = (s: RoleScope) => scopeLabel(s, objectNames.value)

  /** Все области, в которых можно назначить роль */
  const scopeOptions = computed<ScopeOption[]>(() => [
    { key: 'global', label: 'Вся система', group: 'Общее', scope: { type: 'global' } },
    ...catalogs.value.map((c) => ({ key: `catalog:${c.id}`, label: c.name, group: 'Справочники', scope: { type: 'catalog' as const, id: c.id } })),
    ...classifiers.value.map((c) => ({
      key: `classifier:${c.id}`,
      label: c.name,
      group: 'Классификаторы',
      scope: { type: 'classifier' as const, id: c.id },
    })),
  ])

  /** Сколько пользователей держат роль */
  const holders = (roleId: string) => users.value.filter((u) => u.assignments.some((a) => a.roleId === roleId)).length

  /** Обёртка: ошибка → toast, результат или null */
  async function run<T>(fn: () => Promise<T>, ok?: string): Promise<T | null> {
    try {
      const res = await fn()
      if (ok) ui.notify('success', ok)
      return res
    } catch (e) {
      ui.notify('error', 'Операция не выполнена', errorMessage(e))
      return null
    }
  }

  async function load(): Promise<void> {
    loading.value = true
    const res = await run(() =>
      Promise.all([adminApi.users(), adminApi.roles(), adminApi.passwordPolicy(), catalogApi.list(), classifierApi.list()]),
    )
    if (res) [users.value, roles.value, policy.value, catalogs.value, classifiers.value] = res
    loading.value = false
  }

  const replaceUser = (u: User) => (users.value = users.value.map((x) => (x.id === u.id ? u : x)))

  async function createUser(dto: CreateUserDto): Promise<boolean> {
    const u = await run(() => adminApi.createUser(dto), 'Пользователь зарегистрирован')
    if (u) users.value = [...users.value, u]
    return u !== null
  }

  async function saveUser(user: User): Promise<boolean> {
    const u = await run(() => adminApi.updateUser(user), 'Пользователь сохранён')
    if (u) replaceUser(u)
    return u !== null
  }

  async function setStatus(user: User, status: UserStatus): Promise<void> {
    const msg = status === 'deleted' ? 'Пользователь переведён в «удалён»' : status === 'blocked' ? 'Пользователь заблокирован' : 'Пользователь активирован'
    const u = await run(() => adminApi.updateUser({ ...user, status }), msg)
    if (u) replaceUser(u)
  }

  async function deleteUser(user: User): Promise<void> {
    const res = await run(() => adminApi.deleteUser(user.id), 'Пользователь удалён')
    if (res !== null) users.value = users.value.filter((x) => x.id !== user.id)
  }

  /** Возвращает временный пароль — показать администратору один раз */
  async function resetPassword(user: User): Promise<string | null> {
    return (await run(() => adminApi.resetPassword(user.id), 'Пароль сброшен'))?.temporaryPassword ?? null
  }

  async function saveRole(role: Role, isNew: boolean): Promise<boolean> {
    const saved = await run(() => (isNew ? adminApi.createRole(role) : adminApi.saveRole(role)), isNew ? 'Роль создана' : 'Роль сохранена')
    if (saved) roles.value = isNew ? [...roles.value, saved] : roles.value.map((r) => (r.id === saved.id ? saved : r))
    return saved !== null
  }

  async function deleteRole(role: Role): Promise<void> {
    const res = await run(() => adminApi.deleteRole(role.id), 'Роль удалена')
    if (res !== null) roles.value = roles.value.filter((r) => r.id !== role.id)
  }

  async function savePolicy(p: PasswordPolicy): Promise<void> {
    const saved = await run(() => adminApi.savePasswordPolicy(p), 'Политика сохранена')
    if (saved) policy.value = saved
  }

  async function changeOwnPassword(oldPassword: string, newPassword: string): Promise<boolean> {
    return (await run(() => authApi.changePassword({ oldPassword, newPassword }).then(() => true), 'Пароль изменён')) ?? false
  }

  /** Мгновенная подсказка по политике в форме (сервер всё равно проверит) */
  const passwordErrors = (pw: string): string[] => (policy.value ? validatePassword(pw, policy.value) : [])

  return {
    users,
    roles,
    policy,
    catalogs,
    classifiers,
    loading,
    roleName,
    scopeText,
    scopeOptions,
    holders,
    load,
    createUser,
    saveUser,
    setStatus,
    deleteUser,
    resetPassword,
    saveRole,
    deleteRole,
    savePolicy,
    changeOwnPassword,
    passwordErrors,
  }
}
