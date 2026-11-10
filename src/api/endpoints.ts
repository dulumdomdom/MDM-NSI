// ЕДИНСТВЕННОЕ место с URL API. Используется и клиентом (api/*), и моками (mocks/handlers):
// моки вызывают те же функции с ':param' — так маршруты не могут разъехаться.

export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '/api'

type Id = string | number

export const endpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    changePassword: '/auth/password',
    /** Своё отсутствие: отпуск, командировка — и заместитель */
    absence: '/auth/absence',
  },
  /** Журнал действий пользователей */
  audit: '/audit',
  /** Демо-стенд: вернуть исходные данные (только в режиме моков) */
  demoReset: '/demo/reset',
  admin: {
    users: '/admin/users',
    user: (id: Id) => `/admin/users/${id}`,
    resetPassword: (id: Id) => `/admin/users/${id}/reset-password`,
    roles: '/admin/roles',
    role: (id: Id) => `/admin/roles/${id}`,
    passwordPolicy: '/admin/password-policy',
    /** Справочник пользователей для подписей (ФИО по id) — доступен всем вошедшим */
    directory: '/users/directory',
  },
  catalogs: {
    list: '/catalogs',
    one: (id: Id) => `/catalogs/${id}`,
    elements: (catalogId: Id) => `/catalogs/${catalogId}/elements`,
    element: (catalogId: Id, elementId: Id) => `/catalogs/${catalogId}/elements/${elementId}`,
    move: (catalogId: Id, elementId: Id) => `/catalogs/${catalogId}/elements/${elementId}/move`,
    reconcile: (catalogId: Id, elementId: Id) => `/catalogs/${catalogId}/elements/${elementId}/reconcile`,
    /** Присвоение шифра классификатора элементу */
    codes: (catalogId: Id, elementId: Id) => `/catalogs/${catalogId}/elements/${elementId}/codes`,
    code: (catalogId: Id, elementId: Id, classifierId: Id) => `/catalogs/${catalogId}/elements/${elementId}/codes/${classifierId}`,
  },
  classifiers: {
    list: '/classifiers',
    one: (id: Id) => `/classifiers/${id}`,
    entries: (id: Id) => `/classifiers/${id}/entries`,
    duplicateCheck: (id: Id) => `/classifiers/${id}/duplicate-check`,
  },
  requests: {
    list: '/requests',
    one: (id: Id) => `/requests/${id}`,
    decide: (id: Id, stepId: Id) => `/requests/${id}/steps/${stepId}/decision`,
    workflows: '/workflows',
    workflow: (id: Id) => `/workflows/${id}`,
  },
  integrations: {
    systems: '/integrations/systems',
    system: (id: Id) => `/integrations/systems/${id}`,
    /** Проверка связи с внешней системой */
    ping: (id: Id) => `/integrations/systems/${id}/ping`,
    flows: '/integrations/flows',
    flow: (id: Id) => `/integrations/flows/${id}`,
    /** Запуск потока вручную (весь справочник или один элемент) */
    run: (id: Id) => `/integrations/flows/${id}/run`,
    journal: '/integrations/journal',
  },
  notifications: {
    list: '/notifications',
    /** Отметить прочитанными: { ids } или все */
    read: '/notifications/read',
  },
} as const

/** Полный путь (для моков: MSW матчит относительно origin) */
export const fullUrl = (path: string): string => `${API_BASE}${path}`
