// Справочники: структура (CRUD), элементы, поиск, иерархия, шифры элементов.
// RBAC применяется ЗДЕСЬ — до того, как данные попадут в компоненты (visibleAttributes / visibleElements).

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { catalogApi, classifierApi, errorMessage } from '@/api'
import type { AssignCodeDto, ReconcileResult, SaveElementDto } from '@/api/catalog'
import { newCatalog } from '@/lib/catalogSchema'
import { uniqueId } from '@/lib/ids'
import { formatAttribute, textOf } from '@/lib/attributes'
import { searchItems } from '@/lib/search'
import { parseQuery, smartSearch, type SearchField } from '@/lib/smartSearch'
import type { Catalog, CatalogElement, CatalogSummary, Classifier, ReferenceValue, SearchMode } from '@/types'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'

export interface GroupNode {
  key: string
  label: string
  children: GroupNode[]
}

export const useCatalogStore = defineStore('catalog', () => {
  const auth = useAuthStore()
  const ui = useUiStore()

  const summaries = ref<CatalogSummary[]>([])
  const schemas = ref<Record<string, Catalog>>({})
  const elements = ref<Record<string, CatalogElement[]>>({})
  const currentId = ref<string | null>(null)
  const currentParentId = ref<string | null>(null)
  const query = ref('')
  const searchMode = ref<SearchMode>('context')
  const loading = ref(false)

  const currentCatalog = computed(() => (currentId.value ? (schemas.value[currentId.value] ?? null) : null))

  /** Колонки, разрешённые RBAC */
  const visibleAttributes = computed(() => {
    const c = currentCatalog.value
    return c ? auth.filterColumns(c.id, c.attributes) : []
  })

  /** Все доступные строки текущего справочника (RBAC по строкам + вырезание скрытых колонок) */
  const accessibleElements = computed(() => {
    const c = currentCatalog.value
    return c ? auth.filterRows(c.id, elements.value[c.id] ?? []) : []
  })

  /** Текст для поиска: все видимые атрибуты в текстовом виде */
  /** Поля элемента для поиска: видимые атрибуты (наименование — с большим весом) и шифры */
  const searchFields = (el: CatalogElement): SearchField[] => {
    const display = currentCatalog.value?.displayAttributeId
    return [
      ...visibleAttributes.value
        .map((a) => ({ id: a.id, label: a.name, text: formatAttribute(a, el.attributes[a.id]), weight: a.id === display ? 1 : 0.9 }))
        .sort((a, b) => b.weight - a.weight),
      ...(el.codes ?? []).map((c) => ({ id: `code:${c.classifierId}`, label: 'Шифр', text: c.code, weight: 1 })),
    ].filter((f) => f.text !== '')
  }

  /**
   * Поиск по справочнику:
   *  context — все слова запроса в любом порядке (М12/M12, 12х50, 6,5, начала слов, свойства, шифры);
   *  fuzzy   — то же с опечатками, по релевантности;
   *  mask    — шаблон * и ? по любому полю.
   */
  function search(rows: CatalogElement[]): CatalogElement[] {
    if (searchMode.value === 'mask') return searchItems(rows, (el) => searchFields(el).map((f) => f.text), query.value, 'mask')
    const parsed = parseQuery(query.value, visibleAttributes.value)
    const opts = searchMode.value === 'context' ? { requireAll: true, limit: Infinity } : { threshold: 0.45, limit: Infinity }
    return smartSearch(rows, searchFields, parsed, opts).map((h) => h.item)
  }

  /** Строки для таблицы: поиск по всему справочнику, без поиска — текущая группа иерархии */
  const visibleElements = computed(() => {
    const rows = accessibleElements.value
    if (query.value.trim() !== '') return search(rows)
    if (currentCatalog.value?.hierarchical) return rows.filter((r) => (r.parentId ?? null) === currentParentId.value)
    return rows
  })

  /** Дерево групп для навигации по иерархии */
  const groupTree = computed<GroupNode[]>(() => {
    const groups = accessibleElements.value.filter((e) => e.isGroup)
    const nameAttr = currentCatalog.value?.displayAttributeId ?? 'name'
    const build = (parentId: string | null): GroupNode[] =>
      groups
        .filter((g) => (g.parentId ?? null) === parentId)
        .map((g) => ({ key: g.id, label: textOf(g.attributes[nameAttr], g.id), children: build(g.id) }))
    return build(null)
  })

  /** Хлебные крошки текущей группы */
  const breadcrumbs = computed(() => {
    const out: { id: string; label: string }[] = []
    const all = accessibleElements.value
    let cursor = currentParentId.value
    while (cursor) {
      const g = all.find((e) => e.id === cursor)
      if (!g) break
      out.unshift({ id: g.id, label: textOf(g.attributes['name'], g.id) })
      cursor = g.parentId ?? null
    }
    return out
  })

  async function loadList(): Promise<void> {
    summaries.value = await catalogApi.list()
  }

  async function ensureLoaded(catalogId: string, force = false): Promise<void> {
    if (!force && schemas.value[catalogId] && elements.value[catalogId]) return
    const [schema, rows] = await Promise.all([catalogApi.get(catalogId), catalogApi.elements(catalogId)])
    schemas.value = { ...schemas.value, [catalogId]: schema }
    elements.value = { ...elements.value, [catalogId]: rows }
  }

  /** Перечитать элементы текущего справочника (их могли изменить обмен с внешними системами, заявки) */
  async function refresh(elementId?: string): Promise<CatalogElement | undefined> {
    if (!currentId.value) return undefined
    await ensureLoaded(currentId.value, true)
    return elementId ? elements.value[currentId.value]?.find((e) => e.id === elementId) : undefined
  }

  async function open(catalogId: string): Promise<void> {
    loading.value = true
    try {
      currentId.value = catalogId
      currentParentId.value = null
      query.value = ''
      await ensureLoaded(catalogId, true)
    } catch (e) {
      ui.notify('error', 'Не удалось загрузить справочник', errorMessage(e))
    } finally {
      loading.value = false
    }
  }

  function replaceElement(catalogId: string, el: CatalogElement): void {
    const list = elements.value[catalogId] ?? []
    const idx = list.findIndex((x) => x.id === el.id)
    elements.value = {
      ...elements.value,
      [catalogId]: idx === -1 ? [...list, el] : list.map((x) => (x.id === el.id ? el : x)),
    }
  }

  async function saveElement(dto: SaveElementDto, elementId?: string): Promise<CatalogElement | null> {
    const c = currentCatalog.value
    if (!c) return null
    try {
      const res = elementId ? await catalogApi.update(c.id, elementId, dto) : await catalogApi.create(c.id, dto)
      replaceElement(c.id, res.element)
      ui.notify(
        'success',
        elementId ? 'Элемент сохранён' : 'Элемент добавлен',
        res.requestId ? `Отправлен на согласование, заявка ${res.requestId}` : undefined,
      )
      return res.element
    } catch (e) {
      ui.notify('error', 'Ошибка сохранения', errorMessage(e))
      return null
    }
  }

  async function removeElement(elementId: string): Promise<void> {
    const c = currentCatalog.value
    if (!c) return
    try {
      await catalogApi.remove(c.id, elementId)
      elements.value = { ...elements.value, [c.id]: (elements.value[c.id] ?? []).filter((e) => e.id !== elementId) }
      ui.notify('success', 'Элемент удалён')
    } catch (e) {
      ui.notify('error', 'Ошибка удаления', errorMessage(e))
    }
  }

  async function moveElement(elementId: string, parentId: string | null): Promise<void> {
    const c = currentCatalog.value
    if (!c) return
    try {
      replaceElement(c.id, await catalogApi.move(c.id, elementId, parentId))
      ui.notify('success', 'Элемент перенесён')
    } catch (e) {
      ui.notify('error', 'Ошибка переноса', errorMessage(e))
    }
  }

  async function reconcile(elementId: string): Promise<ReconcileResult[]> {
    const c = currentCatalog.value
    if (!c) return []
    try {
      return await catalogApi.reconcile(c.id, elementId)
    } catch (e) {
      ui.notify('error', 'Сверка не выполнена', errorMessage(e))
      return []
    }
  }

  /* ------------------------- шифры элементов ------------------------- */

  /** Конфиги классификаторов: для привязок, колонок шифров и ввода шифра в карточке элемента */
  const classifiers = ref<Record<string, Classifier>>({})

  async function loadClassifiers(ids?: string[]): Promise<void> {
    const wanted = ids ?? (await classifierApi.list()).map((c) => c.id)
    const missing = wanted.filter((id) => !classifiers.value[id])
    if (missing.length === 0) return
    const loaded = await Promise.all(missing.map((id) => classifierApi.get(id)))
    classifiers.value = { ...classifiers.value, ...Object.fromEntries(loaded.map((c) => [c.id, c])) }
  }

  /** Конфиг классификатора всегда свежий (его могли перенастроить) */
  async function freshClassifier(id: string): Promise<Classifier> {
    const c = await classifierApi.get(id)
    classifiers.value = { ...classifiers.value, [id]: c }
    return c
  }

  /** Присвоить шифр: сервер перепроверит его и проверит дубликаты. Возвращает сообщение об ошибке или null */
  async function assignCode(elementId: string, dto: AssignCodeDto): Promise<{ element: CatalogElement; requestId?: string } | string> {
    const c = currentCatalog.value
    if (!c) return 'Справочник не открыт'
    try {
      const res = await catalogApi.assignCode(c.id, elementId, dto)
      replaceElement(c.id, res.element)
      ui.notify('success', 'Шифр присвоен', res.requestId ? `Ушёл на согласование, заявка ${res.requestId}` : 'Согласование не требуется')
      return res
    } catch (e) {
      return errorMessage(e)
    }
  }

  async function removeCode(elementId: string, classifierId: string): Promise<void> {
    const c = currentCatalog.value
    if (!c) return
    try {
      replaceElement(c.id, await catalogApi.removeCode(c.id, elementId, classifierId))
      ui.notify('success', 'Шифр снят')
    } catch (e) {
      ui.notify('error', 'Не удалось снять шифр', errorMessage(e))
    }
  }

  /* ----------------------- структура справочника ----------------------- */

  async function createCatalog(name: string): Promise<Catalog | null> {
    try {
      const c = await catalogApi.createCatalog(newCatalog(uniqueId('cat', name, summaries.value.map((s) => s.id)), name))
      ui.notify('success', 'Справочник создан', 'Настройте атрибуты во вкладке «Структура»')
      return c
    } catch (e) {
      ui.notify('error', 'Справочник не создан', errorMessage(e))
      return null
    }
  }

  async function saveCatalog(c: Catalog): Promise<boolean> {
    try {
      const saved = await catalogApi.saveCatalog(c)
      schemas.value = { ...schemas.value, [saved.id]: saved }
      ui.notify('success', 'Структура справочника сохранена')
      return true
    } catch (e) {
      ui.notify('error', 'Структура не сохранена', errorMessage(e))
      return false
    }
  }

  async function removeCatalog(id: string): Promise<boolean> {
    try {
      await catalogApi.removeCatalog(id)
      summaries.value = summaries.value.filter((s) => s.id !== id)
      const { [id]: _schema, ...restSchemas } = schemas.value
      schemas.value = restSchemas
      ui.notify('success', 'Справочник удалён')
      return true
    } catch (e) {
      ui.notify('error', 'Справочник не удалён', errorMessage(e))
      return false
    }
  }

  /** Варианты для ссылочного атрибута (ReferencePicker): с учётом RBAC целевого справочника */
  async function referenceOptions(catalogId: string, displayAttributeId?: string): Promise<ReferenceValue[]> {
    await ensureLoaded(catalogId)
    const schema = schemas.value[catalogId]
    const attr = displayAttributeId ?? schema?.displayAttributeId ?? 'name'
    return auth
      .filterRows(catalogId, elements.value[catalogId] ?? [])
      .filter((e) => !e.isGroup)
      .map((e) => ({ catalogId, elementId: e.id, display: textOf(e.attributes[attr], e.id) }))
  }

  const setParent = (id: string | null) => (currentParentId.value = id)
  const setSearch = (q: string, mode: SearchMode) => {
    query.value = q
    searchMode.value = mode
  }

  return {
    summaries,
    currentId,
    currentParentId,
    query,
    searchMode,
    loading,
    currentCatalog,
    visibleAttributes,
    visibleElements,
    accessibleElements,
    groupTree,
    breadcrumbs,
    loadList,
    open,
    refresh,
    saveElement,
    removeElement,
    moveElement,
    reconcile,
    assignCode,
    removeCode,
    classifiers,
    loadClassifiers,
    freshClassifier,
    createCatalog,
    saveCatalog,
    removeCatalog,
    referenceOptions,
    setParent,
    setSearch,
  }
})
