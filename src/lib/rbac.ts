// RBAC: права по ресурсам, колонкам и строкам. Чистые функции — их вызывают stores (слой данных),
// а не шаблоны: компоненты получают уже отфильтрованные колонки и строки.

import type {
  AttributeValue,
  CatalogElement,
  Delegation,
  Permission,
  PermissionAction,
  Request,
  RequestStep,
  ResourceType,
  Role,
  RoleAssignment,
  RoleScope,
  RowFilter,
  RowFilterCondition,
  User,
} from '@/types'

/* ------------------------------------------------------------------ */
/* Назначения: роль + область                                         */
/* ------------------------------------------------------------------ */

export const ADMIN_ROLE_ID = 'role-admin'

/**
 * Развернуть назначения в «эффективные роли»: права роли, назначенной на справочник/классификатор,
 * сужаются до этого объекта. Дальше все проверки (can, колонки, строки) работают как обычно.
 */
export function effectiveRoles(assignments: readonly RoleAssignment[], roles: readonly Role[]): Role[] {
  return assignments.flatMap((a) => {
    const role = roles.find((r) => r.id === a.roleId)
    if (!role) return []
    const scope = a.scope
    if (scope.type === 'global') return [role]
    return [
      {
        ...role,
        id: `${role.id}@${scope.type}:${scope.id}`,
        // Права на другой тип объектов в узкой области смысла не имеют; заявки — общие
        permissions: role.permissions
          .filter((p) => p.resource === scope.type || p.resource === 'request')
          .map((p) => (p.resource === scope.type ? { ...p, resourceId: scope.id } : p)),
      },
    ]
  })
}

export const isAdmin = (assignments: readonly RoleAssignment[]): boolean =>
  assignments.some((a) => a.roleId === ADMIN_ROLE_ID && a.scope.type === 'global')

/** Область объекта заявки: справочник или классификатор */
export function requestScope(r: Pick<Request, 'targetType' | 'targetId'>): RoleScope {
  return r.targetType === 'classifier-entry' ? { type: 'classifier', id: r.targetId } : { type: 'catalog', id: r.targetId }
}

/** Покрывает ли область назначения область объекта */
export const scopeCovers = (assigned: RoleScope, target: RoleScope): boolean =>
  assigned.type === 'global' || (target.type !== 'global' && assigned.type === target.type && assigned.id === target.id)

/** Может ли пользователь решить строку обходного листа (роль строки в нужной области или администратор) */
export function canDecideStep(
  assignments: readonly RoleAssignment[],
  request: Pick<Request, 'targetType' | 'targetId' | 'status' | 'sequential' | 'steps'>,
  step: RequestStep,
): boolean {
  if (request.status !== 'in_review' || step.status !== 'pending') return false
  // Последовательный лист: решать можно только первую неподписанную строку
  if (request.sequential && request.steps.find((s) => s.status === 'pending')?.id !== step.id) return false
  if (isAdmin(assignments)) return true
  return isResponsible(assignments, request, step)
}

/**
 * Ответственный за строку:
 *  review — роль строки в области объекта заявки (модератор справочника);
 *  encode — роль строки в области классификатора строки (модератор классификатора шифрует своим классификатором).
 * Глобальное назначение покрывает обе области.
 */
export function isResponsible(
  assignments: readonly RoleAssignment[],
  request: Pick<Request, 'targetType' | 'targetId'>,
  step: Pick<RequestStep, 'roleId' | 'classifierId'>,
): boolean {
  const target: RoleScope = step.classifierId ? { type: 'classifier', id: step.classifierId } : requestScope(request)
  return assignments.some((a) => a.roleId === step.roleId && scopeCovers(a.scope, target))
}

/** Кто видит заявку: администратор, автор и ответственные за её строки */
export function canSeeRequest(assignments: readonly RoleAssignment[], userId: string, request: Request): boolean {
  if (isAdmin(assignments) || request.createdBy === userId) return true
  return request.steps.some((s) => s.decidedBy === userId || isResponsible(assignments, request, s))
}

/* ------------------------------------------------------------------ */
/* Замещение на время отсутствия                                      */
/* ------------------------------------------------------------------ */

/** Отсутствует ли пользователь в момент now (отпуск, командировка) */
export function isAbsent(u: Pick<User, 'absence'>, now: number = Date.now()): boolean {
  return !!u.absence && Date.parse(u.absence.from) <= now && now <= Date.parse(u.absence.until)
}

/** Кого пользователь сейчас замещает. Роль администратора не передаётся */
export function delegationsOf(userId: string, users: readonly User[], now: number = Date.now()): Delegation[] {
  return users
    .filter((u) => u.id !== userId && u.status === 'active' && u.absence?.deputyId === userId && isAbsent(u, now))
    .map((u) => ({
      userId: u.id,
      fullName: u.fullName,
      until: u.absence?.until ?? '',
      assignments: u.assignments.filter((a) => a.roleId !== ADMIN_ROLE_ID),
    }))
}

/** Назначения, с которыми пользователь действует: свои и замещаемых */
export const actingAssignments = (own: readonly RoleAssignment[], delegations: readonly Delegation[]): RoleAssignment[] => [
  ...own,
  ...delegations.flatMap((d) => d.assignments),
]

/**
 * За кого пользователь решает строку: undefined — за себя (или администратор),
 * id — за отсутствующего, которого замещает. Вызывать после canDecideStep.
 */
export function onBehalfOf(
  own: readonly RoleAssignment[],
  delegations: readonly Delegation[],
  request: Pick<Request, 'targetType' | 'targetId'>,
  step: Pick<RequestStep, 'roleId' | 'classifierId'>,
): string | undefined {
  if (isAdmin(own) || isResponsible(own, request, step)) return undefined
  return delegations.find((d) => isResponsible(d.assignments, request, step))?.userId
}

/**
 * Кому адресована строка сейчас: ответственные, а за отсутствующих — их заместители
 * (deputyFor — кого замещает адресат). Без повторов.
 */
export function responsibleUsers(
  users: readonly User[],
  request: Pick<Request, 'targetType' | 'targetId'>,
  step: Pick<RequestStep, 'roleId' | 'classifierId'>,
  now: number = Date.now(),
): { userId: string; deputyFor?: string }[] {
  const out = new Map<string, { userId: string; deputyFor?: string }>()
  for (const u of users) {
    if (u.status !== 'active' || !isResponsible(u.assignments, request, step)) continue
    const deputy = isAbsent(u, now) ? users.find((d) => d.id === u.absence?.deputyId && d.status === 'active') : undefined
    if (deputy) {
      if (!out.has(deputy.id)) out.set(deputy.id, { userId: deputy.id, deputyFor: u.id })
    } else out.set(u.id, { userId: u.id })
  }
  return [...out.values()]
}

/** Просрочена ли строка (срок прошёл, решения нет) */
export const isOverdue = (step: Pick<RequestStep, 'status' | 'dueAt'>, now: number = Date.now()): boolean =>
  step.status === 'pending' && !!step.dueAt && Date.parse(step.dueAt) < now

/** Подписи областей для UI */
export function scopeLabel(scope: RoleScope, names: Readonly<Record<string, string>> = {}): string {
  if (scope.type === 'global') return 'Вся система'
  const kind = scope.type === 'catalog' ? 'Справочник' : 'Классификатор'
  return `${kind}: ${names[scope.id] ?? scope.id}`
}

/* ------------------------------------------------------------------ */
/* Проверки прав                                                      */
/* ------------------------------------------------------------------ */

/** Все права ролей на конкретный ресурс (с учётом '*') */
export function permissionsFor(roles: readonly Role[], resource: ResourceType, resourceId: string): Permission[] {
  return roles.flatMap((r) => r.permissions).filter((p) => p.resource === resource && (p.resourceId === '*' || p.resourceId === resourceId))
}

export function can(roles: readonly Role[], resource: ResourceType, resourceId: string, action: PermissionAction): boolean {
  return permissionsFor(roles, resource, resourceId).some((p) => p.actions.includes(action))
}

/** Есть ли право хотя бы на один объект этого типа (меню, маршруты-списки) */
export function canAny(roles: readonly Role[], resource: ResourceType, action: PermissionAction): boolean {
  return roles.some((r) => r.permissions.some((p) => p.resource === resource && p.actions.includes(action)))
}

/** Право на объекты ЛЮБОГО id этого типа — нужно для создания новых справочников/классификаторов */
export function canGlobally(roles: readonly Role[], resource: ResourceType, action: PermissionAction): boolean {
  return roles.some((r) => r.permissions.some((p) => p.resource === resource && p.resourceId === '*' && p.actions.includes(action)))
}

/** Разрешённые на чтение колонки: объединение по всем ролям. '*' — без ограничений */
export function allowedColumns(roles: readonly Role[], resource: ResourceType, resourceId: string): Set<string> | '*' {
  const perms = permissionsFor(roles, resource, resourceId).filter((p) => p.actions.includes('read'))
  if (perms.some((p) => p.columnIds === '*')) return '*'
  return new Set(perms.flatMap((p) => (p.columnIds === '*' ? [] : p.columnIds)))
}

export function canAccessColumn(roles: readonly Role[], catalogId: string, columnId: string): boolean {
  const cols = allowedColumns(roles, 'catalog', catalogId)
  return cols === '*' || cols.has(columnId)
}

/** Примитив для сравнения: ссылки сравниваются по elementId */
function comparable(v: AttributeValue | undefined): string | number | null {
  if (v === undefined || v === null) return null
  if (typeof v === 'string' || typeof v === 'number') return v
  if ('elementId' in v && typeof v.elementId === 'string') return v.elementId
  return null
}

function fieldValue(el: CatalogElement, field: string): string | number | null {
  if (field === '$state') return el.state
  if (field === '$parentId') return el.parentId ?? null
  return comparable(el.attributes[field])
}

function conditionMatches(c: RowFilterCondition, el: CatalogElement): boolean {
  const v = fieldValue(el, c.field)
  const list = Array.isArray(c.value) ? c.value : [c.value]
  switch (c.op) {
    case 'eq':
      return v === c.value
    case 'neq':
      return v !== c.value
    case 'in':
      return v !== null && list.includes(v)
    case 'notIn':
      return v === null || !list.includes(v)
    default: {
      const exhaustive: never = c.op
      return exhaustive
    }
  }
}

export function rowMatches(filter: RowFilter, el: CatalogElement): boolean {
  return filter.all.every((c) => conditionMatches(c, el))
}

/** Строка доступна, если хотя бы одно read-право её пропускает (нет фильтра — пропускает всё) */
export function canAccessRow(roles: readonly Role[], catalogId: string, el: CatalogElement): boolean {
  return permissionsFor(roles, 'catalog', catalogId)
    .filter((p) => p.actions.includes('read'))
    .some((p) => !p.rowFilter || rowMatches(p.rowFilter, el))
}

export function filterColumns<T extends { id: string }>(roles: readonly Role[], catalogId: string, columns: readonly T[]): T[] {
  const cols = allowedColumns(roles, 'catalog', catalogId)
  return cols === '*' ? [...columns] : columns.filter((c) => cols.has(c.id))
}

/** Фильтр строк + вырезание значений недоступных колонок (чтобы они не утекли в UI/экспорт) */
export function filterRows(roles: readonly Role[], catalogId: string, rows: readonly CatalogElement[]): CatalogElement[] {
  const cols = allowedColumns(roles, 'catalog', catalogId)
  return rows
    .filter((el) => canAccessRow(roles, catalogId, el))
    .map((el) =>
      cols === '*' ? el : { ...el, attributes: Object.fromEntries(Object.entries(el.attributes).filter(([k]) => cols.has(k))) },
    )
}
