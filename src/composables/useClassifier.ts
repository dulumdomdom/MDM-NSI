// Связка сессии ввода шифра с UI: фокус полей, дерево для PrimeVue Tree, сегменты шифра.
// Сессия берётся из provide (диалог присвоения шифра элементу) или из store страницы классификатора.

import { computed, nextTick, watch } from 'vue'
import { codeSegments, formatCondition, type CodeSegment, type ParsedFacet } from '@/lib/classifier'
import { useClassifierStore } from '@/stores/classifier'
import { injectClassifierSession, type ClassifierSession } from './useClassifierSession'
import type { Classifier, FacetConfig, StructureNode } from '@/types'

/** Узел для PrimeVue Tree */
export interface FacetTreeNode {
  key: string
  label: string
  icon: string
  data: { kind: StructureNode['kind']; condition: string; facetId?: string; inPath: boolean; isDefault: boolean }
  children: FacetTreeNode[]
}

/** Дерево классификатора для PrimeVue Tree (path — подсвечиваемые ноды) */
export const buildTreeNodes = (c: Classifier, path: Set<string> = new Set()): FacetTreeNode[] => [
  toTreeNode(c.tree, new Map(c.facets.map((f) => [f.id, f])), path, false),
]

/** id DOM-элемента поля фасета — единый для мастера и превью */
export const facetInputId = (facetId: string): string => `facet-input-${facetId}`

export function toTreeNode(node: StructureNode, facets: Map<string, FacetConfig>, path: Set<string>, isDefault: boolean): FacetTreeNode {
  const facet = node.facetId ? facets.get(node.facetId) : undefined
  return {
    key: node.id,
    label: facet?.name ?? node.name,
    icon: node.kind === 'root' ? 'pi pi-sitemap' : node.kind === 'catalog' ? 'pi pi-folder' : 'pi pi-tag',
    data: {
      kind: node.kind,
      condition: node.transitionCondition ? formatCondition(node.transitionCondition) : '',
      ...(node.facetId ? { facetId: node.facetId } : {}),
      inPath: path.has(node.id),
      isDefault,
    },
    children: node.children.map((c, i) => toTreeNode(c, facets, path, node.children.length > 1 && i === node.defaultChildIndex)),
  }
}

export function useClassifier() {
  const store: ClassifierSession = injectClassifierSession() ?? useClassifierStore()

  const pathSet = computed(() => new Set(store.parseResult?.path ?? []))

  const treeNodes = computed<FacetTreeNode[]>(() => {
    const c = store.classifier
    return c ? buildTreeNodes(c, pathSet.value) : []
  })

  /** Раскрыть все ноды текущего пути */
  const expandedKeys = computed<Record<string, boolean>>(() =>
    Object.fromEntries([...pathSet.value, store.classifier?.tree.id ?? 'root'].map((k) => [k, true])),
  )

  /** Чипы превью в порядке СТРОКИ шифра (для rtl — справа налево по фасетам) */
  const previewChips = computed<ParsedFacet[]>(() => {
    const list = [...store.visibleFacets]
    return store.classifier?.readDirection === 'rtl' ? list.reverse() : list
  })

  /** Шифр, размеченный на сегменты (фасеты / разделители / остаток) — для превью */
  const segments = computed<CodeSegment[]>(() =>
    store.parseResult && store.classifier ? codeSegments(store.parseResult, store.classifier.readDirection) : [],
  )

  /** Описания правил по id — для подсказки «почему поле изменилось» */
  const ruleDescriptions = computed(() => {
    const map = new Map<string, string>()
    for (const f of store.classifier?.facets ?? []) for (const r of f.dependencies ?? []) map.set(r.id, r.description ?? r.id)
    return (ids: readonly string[]): string => ids.map((id) => map.get(id) ?? id).join('\n')
  })

  /** Фокус на поле фасета: работает для любого режима, где есть элемент с facetInputId */
  async function focusField(facetId: string): Promise<void> {
    store.focusFacet(facetId)
    await nextTick()
    const el = document.getElementById(facetInputId(facetId))
    const focusable = 'input,textarea,button,[tabindex]:not([tabindex="-1"])'
    const target = el?.matches(focusable) ? el : el?.querySelector<HTMLElement>(focusable)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    target?.focus()
  }

  /** Перейти к следующему фасету: сначала к ближайшему пустому после текущего, иначе — просто к следующему */
  async function focusNext(facetId: string): Promise<void> {
    await nextTick() // путь мог измениться после ввода значения
    const list = store.visibleFacets
    const idx = list.findIndex((f) => f.facetId === facetId)
    const after = list.slice(idx + 1)
    const next = after.find((f) => f.value === '') ?? after[0]
    if (next) await focusField(next.facetId)
  }

  /** Фасет под кареткой в поле шифра (позиция — в символах строки) */
  function facetAt(pos: number): ParsedFacet | undefined {
    const withSpan = store.visibleFacets.filter((f) => f.span)
    return withSpan.find((f) => f.span && pos >= f.span.start && pos < f.span.end) ?? withSpan.find((f) => f.span?.end === pos)
  }

  /** Мастер реагирует на смену фокуса (из дерева или превью) */
  function onFocusRequest(cb: (facetId: string) => void): void {
    watch(
      () => store.focusFacetId,
      (id) => {
        if (id) cb(id)
      },
    )
  }

  return { store, treeNodes, expandedKeys, previewChips, segments, ruleDescriptions, focusField, focusNext, facetAt, onFocusRequest }
}
