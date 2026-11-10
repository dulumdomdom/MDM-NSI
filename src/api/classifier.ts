// Контракты: классификаторы.

import type { Classifier, ClassifierEntry, ClassifierSummary } from '@/types'
import { api } from './client'
import { endpoints } from './endpoints'

export interface DuplicateCheckResult {
  duplicate: boolean
  /** Где найден дубликат: запись классификатора, заявка на согласовании или шифр элемента справочника */
  source?: 'entry' | 'request' | 'element'
  entry?: ClassifierEntry
  requestId?: string
  /** Для source = 'element' */
  element?: { catalogId: string; elementId: string; display: string }
}

export const classifierApi = {
  list: () => api.get<ClassifierSummary[]>(endpoints.classifiers.list),
  get: (id: string) => api.get<Classifier>(endpoints.classifiers.one(id)),
  create: (c: Classifier) => api.post<Classifier>(endpoints.classifiers.list, c),
  save: (c: Classifier) => api.put<Classifier>(endpoints.classifiers.one(c.id), c),
  remove: (id: string) => api.delete(endpoints.classifiers.one(id)),
  entries: (id: string) => api.get<ClassifierEntry[]>(endpoints.classifiers.entries(id)),
  /** excludeElementId — не считать дубликатом шифр, уже присвоенный этому же элементу (переприсвоение) */
  duplicateCheck: (id: string, catalogId: string, code: string, excludeElementId?: string) =>
    api.post<DuplicateCheckResult>(endpoints.classifiers.duplicateCheck(id), { catalogId, code, excludeElementId }),
}
