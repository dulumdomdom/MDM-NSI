// Пользователи, роли, права, парольная политика.
//
// Модель доступа: Роль — ШАБЛОН прав (что можно делать). Назначение — роль + ОБЛАСТЬ (где):
// вся система, конкретный справочник или конкретный классификатор. Пользователю выдают назначения.
// Права роли с resourceId '*' внутри назначения на справочник X означают «только справочник X».

import type { IsoDateTime } from './common'

export type AuthProvider = 'local' | 'ldap'

export type UserStatus = 'active' | 'blocked' | 'deleted'

/** Область действия назначения */
export type ScopeType = 'global' | 'catalog' | 'classifier'

export type RoleScope = { type: 'global' } | { type: 'catalog' | 'classifier'; id: string }

/** Назначение роли пользователю в области */
export interface RoleAssignment {
  roleId: string
  scope: RoleScope
}

export interface User {
  id: string
  login: string
  fullName: string
  email?: string
  phone?: string
  /** Должность / подразделение — для обходных листов */
  position?: string
  assignments: RoleAssignment[]
  status: UserStatus
  provider: AuthProvider
  /** Срок действия аккаунта */
  expiresAt?: IsoDateTime
  passwordChangedAt?: IsoDateTime
  /** Отсутствие (отпуск, командировка): строки заявок и уведомления уходят заместителю */
  absence?: Absence
}

export interface Absence {
  from: IsoDateTime
  until: IsoDateTime
  deputyId: string
  reason: string
}

/** Чьи обязанности пользователь исполняет сейчас (он — заместитель отсутствующего) */
export interface Delegation {
  userId: string
  fullName: string
  until: IsoDateTime
  /** Назначения отсутствующего (без роли администратора — её не передают) */
  assignments: RoleAssignment[]
}

/** Хранимые учётные данные (только на сервере / в моках; на клиент не уходят) */
export interface StoredCredential {
  userId: string
  /** SHA-512(salt + password), hex */
  hash: string
  salt: string
  /** Хэши предыдущих паролей — для правила «N уникальных паролей» */
  history: string[]
}

/**
 * Действия над объектом:
 *  read/create/update/delete — данные (элементы справочника, записи классификатора);
 *  configure — структура (атрибуты, фасеты, дерево, согласование) и создание/удаление самих справочников и классификаторов;
 *  approve — согласование заявок.
 */
export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'configure'

export type ResourceType = 'catalog' | 'classifier' | 'request' | 'admin' | 'audit'

/** Фильтр строк: элемент виден, если ВСЕ условия выполнены */
export interface RowFilterCondition {
  /** id атрибута или служебное поле '$state' / '$parentId' */
  field: string
  op: 'eq' | 'neq' | 'in' | 'notIn'
  value: string | number | (string | number)[]
}

export interface RowFilter {
  all: RowFilterCondition[]
}

export interface Permission {
  resource: ResourceType
  /** id ресурса или '*' (все в пределах области назначения) */
  resourceId: string
  actions: PermissionAction[]
  /** Разрешённые колонки (атрибуты). '*' — все */
  columnIds: string[] | '*'
  /** Ограничение по строкам. Нет — все строки */
  rowFilter?: RowFilter
}

export interface Role {
  id: string
  name: string
  description?: string
  permissions: Permission[]
  /** Системная роль — нельзя удалить */
  system?: boolean
  /** В каких областях роль можно назначать (по умолчанию — во всех) */
  scopes?: ScopeType[]
}

export interface PasswordPolicy {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireDigits: boolean
  requireSpecial: boolean
  /** Период смены пароля, дней (0 — без ограничения) */
  maxAgeDays: number
  /** Сколько последних паролей нельзя повторять */
  uniqueHistoryCount: number
}

export interface LoginRequest {
  login: string
  password: string
  provider: AuthProvider
}

export interface Session {
  token: string
  user: User
  /** Роли, на которые ссылаются назначения пользователя */
  roles: Role[]
  /** Требуется смена пароля (истёк по политике) */
  passwordExpired: boolean
  /** Замещения, действующие сейчас */
  delegations: Delegation[]
}
