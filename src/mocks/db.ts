// In-memory «база» моков: изменяемые копии сид-данных. Сбрасывается при перезагрузке страницы.

import type {
  AppNotification,
  AuditEntry,
  ExchangeRecord,
  ExternalSystem,
  IntegrationFlow,
  Catalog,
  CatalogElement,
  Classifier,
  ClassifierEntry,
  PasswordPolicy,
  Request,
  Role,
  StoredCredential,
  User,
  WorkflowConfig,
} from '@/types'
import { catalogElements, catalogs } from './data/catalogs'
import { allClassifiers } from './data/classifiers'
import { auditLog, classifierEntries, notifications, requests, workflows } from './data/requests'
import { flows, incoming, journal, systems, type IncomingItem } from './data/integrations'
import { credentials, ldapDirectory, passwordPolicy, roles, users } from './data/users'

export interface MockDb {
  users: User[]
  roles: Role[]
  credentials: StoredCredential[]
  ldap: Record<string, string>
  passwordPolicy: PasswordPolicy
  catalogs: Catalog[]
  elements: CatalogElement[]
  classifiers: Classifier[]
  entries: ClassifierEntry[]
  workflows: WorkflowConfig[]
  requests: Request[]
  notifications: AppNotification[]
  systems: ExternalSystem[]
  flows: IntegrationFlow[]
  journal: ExchangeRecord[]
  audit: AuditEntry[]
  /** Имитация данных во внешних системах (для импорта) */
  incoming: Record<string, IncomingItem[]>
}

function seed(): MockDb {
  return structuredClone({
    users,
    roles,
    credentials,
    ldap: ldapDirectory,
    passwordPolicy,
    catalogs,
    elements: catalogElements,
    classifiers: allClassifiers,
    entries: classifierEntries,
    workflows,
    requests,
    notifications,
    systems,
    flows,
    journal,
    incoming,
    audit: auditLog,
  })
}

export let db: MockDb = seed()

/** Для тестов и кнопки «Сбросить демо-данные»: вернуть исходное состояние */
export function resetDb(): void {
  db = seed()
}

/** Подменить базу целиком (восстановление сохранённых демо-данных) */
export function replaceDb(next: MockDb): void {
  db = next
}

/** Версия сид-данных: меняется вместе с данными в коде — старые сохранения тогда не подхватываются */
export const seedVersion: string = (() => {
  const text = JSON.stringify(seed())
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0
  return `${text.length}-${h.toString(16)}`
})()

let seq = 1000
export const nextId = (prefix: string): string => `${prefix}-${++seq}`
export const nowIso = (): string => new Date().toISOString()
