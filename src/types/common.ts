// Общие типы, не привязанные к модулю

/** ISO-8601 строка даты/времени (как приходит из API) */
export type IsoDateTime = string

/** Пара «код — наименование»: значения фасетов, состояния, справочные списки */
export interface CodeName {
  code: string
  name: string
}

/** Страница списка — единый формат пагинации API */
export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

/** Ошибка API в нормализованном виде (см. api/client.ts) */
export interface ApiErrorBody {
  code: string
  message: string
  details?: Record<string, string>
}
