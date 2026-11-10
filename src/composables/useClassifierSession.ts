// Сессия ввода шифра — независимый экземпляр состояния над ОДНИМ движком lib/classifier.
// Используется страницей классификатора (через store) и диалогом присвоения шифра элементу справочника.
//  - setCode(code)   — direct: строка → parseCode → значения фасетов;
//  - setFacet(i, v)  — wizard: значение фасета → analyzeValues → собранный шифр.
// Источник истины — последнее изменение (source): так в direct сохраняются «лишние символы» как ошибка.

import { computed, inject, provide, reactive, ref, type InjectionKey, type UnwrapNestedRefs } from 'vue'
import {
  analyzeValues,
  buildShortName,
  decode,
  getCatalogs,
  parseCode,
  valuesForNode,
  type ParsedFacet,
  type ParseResult,
} from '@/lib/classifier'
import type { Classifier, ClassifierInputMode, ClassifierSection } from '@/types'

export interface SectionGroup {
  section: ClassifierSection
  facets: ParsedFacet[]
}

export function createClassifierSession() {
  const classifier = ref<Classifier | null>(null)
  const catalogId = ref('')
  const inputCode = ref('')
  const facetValues = ref<Record<string, string>>({})
  const source = ref<'code' | 'values'>('values')
  const activeInputMode = ref<ClassifierInputMode>('direct')
  /** Фасет, на который нужно поставить фокус (клик по сегменту / по ноде дерева) */
  const focusFacetId = ref<string | null>(null)
  const saving = ref(false)

  /* ----------------------------- derived ----------------------------- */

  const parseResult = computed<ParseResult | null>(() => {
    const c = classifier.value
    if (!c || !catalogId.value) return null
    return source.value === 'code' ? parseCode(c, catalogId.value, inputCode.value) : analyzeValues(c, catalogId.value, facetValues.value)
  })

  const parsedFacets = computed(() => parseResult.value?.facets ?? [])
  const visibleFacets = computed(() => parsedFacets.value.filter((f) => f.visible))
  const dependencyOverrides = computed(() => parseResult.value?.overrides ?? {})
  const issues = computed(() => parseResult.value?.issues ?? [])
  const catalogs = computed(() => (classifier.value ? getCatalogs(classifier.value) : []))
  const availableModes = computed(() => classifier.value?.inputModes ?? [])

  const decoded = computed(() => (classifier.value && parseResult.value ? decode(classifier.value, parseResult.value) : null))
  const decodedString = computed(() => decoded.value?.text ?? '')

  const shortName = computed(() => {
    const rule = classifier.value?.shortNameRule
    return rule && decoded.value ? buildShortName(rule, decoded.value.parts) : ''
  })

  /** Видимые фасеты, сгруппированные по смысловым блокам (секции — из конфига) */
  const sections = computed<SectionGroup[]>(() => {
    const list = [...(classifier.value?.sections ?? [])].sort((a, b) => a.order - b.order)
    return list
      .map((section) => ({ section, facets: visibleFacets.value.filter((f) => f.section === section.id) }))
      .filter((g) => g.facets.length > 0)
  })

  const canSubmit = computed(() => !!parseResult.value?.valid && parseResult.value.code !== '' && !saving.value)

  /* ----------------------------- actions ----------------------------- */

  function reset(): void {
    inputCode.value = ''
    facetValues.value = {}
    source.value = 'values'
    focusFacetId.value = null
  }

  /** Установить конфиг; catalog — каталог классификатора (по умолчанию первый) */
  function setClassifier(c: Classifier | null, catalog?: string): void {
    classifier.value = c
    catalogId.value = c ? (catalog && getCatalogs(c).some((x) => x.id === catalog) ? catalog : (getCatalogs(c)[0]?.id ?? '')) : ''
    activeInputMode.value = c?.inputModes[0] ?? 'direct'
    reset()
  }

  /** direct: строка шифра → значения фасетов */
  function setCode(code: string): void {
    inputCode.value = code
    source.value = 'code'
    const c = classifier.value
    if (c && catalogId.value) facetValues.value = { ...parseCode(c, catalogId.value, code).values }
  }

  /** wizard: i — индекс фасета в текущем пути (parsedFacets) */
  function setFacet(i: number, value: string): void {
    const f = parsedFacets.value[i]
    if (f) setFacetById(f.facetId, value)
  }

  function setFacetById(facetId: string, value: string): void {
    const c = classifier.value
    if (!c) return
    facetValues.value = { ...facetValues.value, [facetId]: value }
    source.value = 'values'
    inputCode.value = analyzeValues(c, catalogId.value, facetValues.value).code
  }

  function selectCatalog(id: string): void {
    if (id === catalogId.value) return
    catalogId.value = id
    reset()
  }

  /** Переход к ноде дерева: подбор значений родителей, чтобы путь прошёл через ноду */
  function navigateTree(nodeId: string): void {
    const c = classifier.value
    if (!c) return
    const nav = valuesForNode(c, nodeId, facetValues.value)
    if (!nav) return
    if (nav.catalogId !== catalogId.value) {
      catalogId.value = nav.catalogId
      facetValues.value = valuesForNode(c, nodeId, {})?.values ?? {}
    } else {
      facetValues.value = nav.values
    }
    source.value = 'values'
    inputCode.value = analyzeValues(c, catalogId.value, facetValues.value).code
    focusFacetId.value = nav.focusFacetId
  }

  function setMode(mode: ClassifierInputMode): void {
    if (availableModes.value.includes(mode)) activeInputMode.value = mode
  }

  const focusFacet = (facetId: string | null) => (focusFacetId.value = facetId)

  return {
    classifier,
    catalogId,
    inputCode,
    facetValues,
    activeInputMode,
    focusFacetId,
    saving,
    parseResult,
    parsedFacets,
    visibleFacets,
    dependencyOverrides,
    issues,
    catalogs,
    availableModes,
    decoded,
    decodedString,
    shortName,
    sections,
    canSubmit,
    setClassifier,
    reset,
    setCode,
    setFacet,
    setFacetById,
    selectCatalog,
    navigateTree,
    setMode,
    focusFacet,
  }
}

/** Сессия с развёрнутыми ref — так её видят компоненты (как и Pinia store) */
export type ClassifierSession = UnwrapNestedRefs<ReturnType<typeof createClassifierSession>>

export const CLASSIFIER_SESSION: InjectionKey<ClassifierSession> = Symbol('classifier-session')

/** Создать отдельную сессию и отдать её дочерним компонентам ввода (CodeInput, FacetWizard, DecodePanel) */
export function provideClassifierSession(): ClassifierSession {
  const session = reactive(createClassifierSession())
  provide(CLASSIFIER_SESSION, session)
  return session
}

export const injectClassifierSession = (): ClassifierSession | null => inject(CLASSIFIER_SESSION, null)
