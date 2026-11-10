// Контракты: справочники (структура и элементы), присвоение шифров элементам.

import type { AttributeValue, Catalog, CatalogElement, CatalogSummary, ElementCode } from '@/types'
import { api } from './client'
import { endpoints } from './endpoints'

export interface SaveElementDto {
  attributes: Record<string, AttributeValue>
  state: string
  parentId?: string
  isGroup?: boolean
}

/** Результат сохранения элемента: если для справочника настроено согласование — создаётся заявка */
export interface SaveElementResult {
  element: CatalogElement
  requestId?: string
}

/** Результат сверки с внешней базой НСИ */
export interface ReconcileResult {
  source: string
  found: boolean
  externalName?: string
  similarity?: number
}

export type AssignCodeDto = Pick<ElementCode, 'classifierId' | 'catalogId' | 'code' | 'decoded' | 'shortName'>

/** Присвоение шифра: элемент с новым шифром + заявка, если шифр уходит на согласование */
export interface AssignCodeResult {
  element: CatalogElement
  requestId?: string
}

export const catalogApi = {
  list: () => api.get<CatalogSummary[]>(endpoints.catalogs.list),
  get: (id: string) => api.get<Catalog>(endpoints.catalogs.one(id)),
  /** Структура справочника: создание, сохранение, удаление (право configure) */
  createCatalog: (c: Catalog) => api.post<Catalog>(endpoints.catalogs.list, c),
  saveCatalog: (c: Catalog) => api.put<Catalog>(endpoints.catalogs.one(c.id), c),
  removeCatalog: (id: string) => api.delete(endpoints.catalogs.one(id)),

  elements: (catalogId: string) => api.get<CatalogElement[]>(endpoints.catalogs.elements(catalogId)),
  create: (catalogId: string, dto: SaveElementDto) => api.post<SaveElementResult>(endpoints.catalogs.elements(catalogId), dto),
  update: (catalogId: string, elementId: string, dto: SaveElementDto) =>
    api.put<SaveElementResult>(endpoints.catalogs.element(catalogId, elementId), dto),
  remove: (catalogId: string, elementId: string) => api.delete(endpoints.catalogs.element(catalogId, elementId)),
  move: (catalogId: string, elementId: string, parentId: string | null) =>
    api.post<CatalogElement>(endpoints.catalogs.move(catalogId, elementId), { parentId }),
  reconcile: (catalogId: string, elementId: string) =>
    api.post<ReconcileResult[]>(endpoints.catalogs.reconcile(catalogId, elementId)),

  assignCode: (catalogId: string, elementId: string, dto: AssignCodeDto) =>
    api.post<AssignCodeResult>(endpoints.catalogs.codes(catalogId, elementId), dto),
  removeCode: (catalogId: string, elementId: string, classifierId: string) =>
    api.delete<CatalogElement>(endpoints.catalogs.code(catalogId, elementId, classifierId)),
}
