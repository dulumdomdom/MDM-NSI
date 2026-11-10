// Обёртка над auth store для компонентов + меню, отфильтрованное по правам (RBAC в слое данных).

import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { PermissionAction, ResourceType } from '@/types'

export interface MenuItem {
  label: string
  icon: string
  to: string
  /** Группа в сайдбаре */
  group: 'main' | 'data' | 'process' | 'system'
  permission?: { resource: ResourceType; action: PermissionAction }
}

export const MENU_GROUPS: Record<MenuItem['group'], string> = {
  main: '',
  data: 'Данные',
  process: 'Процессы',
  system: 'Система',
}

/** Пункты навигации — данные; видимость считается из прав пользователя */
const MENU: MenuItem[] = [
  { label: 'Главная', icon: 'pi pi-home', to: '/', group: 'main' },
  { label: 'Справочники', icon: 'pi pi-book', to: '/catalogs', group: 'data', permission: { resource: 'catalog', action: 'read' } },
  { label: 'Классификаторы', icon: 'pi pi-sitemap', to: '/classifiers', group: 'data', permission: { resource: 'classifier', action: 'read' } },
  { label: 'Пополнение', icon: 'pi pi-plus-circle', to: '/intake', group: 'process', permission: { resource: 'request', action: 'create' } },
  { label: 'Заявки', icon: 'pi pi-inbox', to: '/requests', group: 'process', permission: { resource: 'request', action: 'read' } },
  { label: 'Администрирование', icon: 'pi pi-shield', to: '/admin', group: 'system', permission: { resource: 'admin', action: 'read' } },
  { label: 'Журнал действий', icon: 'pi pi-history', to: '/audit', group: 'system', permission: { resource: 'audit', action: 'read' } },
  { label: 'Интеграции', icon: 'pi pi-arrow-right-arrow-left', to: '/integrations', group: 'system', permission: { resource: 'admin', action: 'read' } },
]

export function useAuth() {
  const store = useAuthStore()
  const { user, roles, isAuthenticated } = storeToRefs(store)

  /** Есть ли право хотя бы на один объект ресурса (для меню и маршрутов) */
  const canAny = (resource: ResourceType, action: PermissionAction): boolean => store.canAny(resource, action)

  const menu = computed(() => MENU.filter((m) => !m.permission || canAny(m.permission.resource, m.permission.action)))

  /** Меню, разложенное по группам (пустые группы не показываются) */
  const menuGroups = computed(() =>
    (Object.keys(MENU_GROUPS) as MenuItem['group'][])
      .map((g) => ({ id: g, title: MENU_GROUPS[g], items: menu.value.filter((m) => m.group === g) }))
      .filter((g) => g.items.length > 0),
  )

  // Одна роль может быть назначена в нескольких областях — показываем название один раз
  const roleNames = computed(() => [...new Set(roles.value.map((r) => r.name))].join(', '))

  /** Инициалы для аватара: «Петров Пётр» → «ПП» */
  const initials = computed(() =>
    (user.value?.fullName ?? '')
      .split(/\s+/)
      .filter((w) => /^\p{L}/u.test(w))
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join(''),
  )

  return {
    user,
    roles,
    roleNames,
    initials,
    isAuthenticated,
    menu,
    menuGroups,
    canAny,
    can: store.can,
    login: store.login,
    logout: store.logout,
  }
}
