// Редактирование конфигурации классификатора на черновике: общие свойства, смысловые блоки, фасеты,
// дерево структуры (ноды, условия переходов), зависимости, расшифровка, краткое наименование.
// Конфиг — данные: правим копию, проверяем целостность (lib) и сохраняем целиком.

import { deepClone } from '@/lib/clone'
import { computed, ref, watch } from 'vue'
import {
  addChild,
  facetUsage,
  findNode,
  newCatalogNode,
  newFacet,
  newFacetNode,
  removeNode,
  updateNode,
  validateClassifier,
  validateRules,
} from '@/lib/classifier'
import { uniqueId } from '@/lib/ids'
import { useClassifierStore } from '@/stores/classifier'
import { useUiStore } from '@/stores/ui'
import type {
  Classifier,
  ClassifierSection,
  CodeName,
  DecodeStructure,
  FacetConfig,
  FacetDependencyRule,
  ShortNameRule,
  StructureNode,
  TransitionCondition,
} from '@/types'

/** «code = name» построчно → список значений */
export function parseOptionsText(text: string): CodeName[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [code = '', ...rest] = line.split('=')
      const name = rest.join('=').trim()
      return { code: code.trim(), name: name || code.trim() }
    })
}

export const optionsToText = (options: readonly CodeName[] | undefined): string =>
  (options ?? []).map((o) => `${o.code} = ${o.name}`).join('\n')

/** Глубокая копия конфига (с реактивными прокси на любой глубине) */
const cloneConfig = (c: Classifier): Classifier => deepClone(c)

export type GeneralPatch = Partial<Pick<Classifier, 'name' | 'description' | 'readDirection' | 'inputModes' | 'allowedCharsPattern'>>

export function useClassifierConfig() {
  const store = useClassifierStore()
  const ui = useUiStore()

  const draft = ref<Classifier | null>(null)
  const selectedNodeId = ref<string | null>(null)
  const saving = ref(false)

  watch(
    () => store.classifier,
    (c) => (draft.value = c ? cloneConfig(c) : null),
    { immediate: true },
  )

  const selectedNode = computed(() => (draft.value && selectedNodeId.value ? findNode(draft.value.tree, selectedNodeId.value) : null))
  const selectedFacet = computed(() => {
    const id = selectedNode.value?.facetId
    return id ? (draft.value?.facets.find((f) => f.id === id) ?? null) : null
  })
  const issues = computed(() => (draft.value ? validateClassifier(draft.value) : []))
  const ruleIssues = computed(() => (draft.value ? validateRules(draft.value) : []))
  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(store.classifier))

  /** Изменить черновик (все правки — через неё) */
  function edit(fn: (c: Classifier) => Classifier): void {
    if (draft.value) draft.value = fn(draft.value)
  }

  /* ------------------------------ общее ------------------------------ */

  const setGeneral = (patch: GeneralPatch) => edit((c) => ({ ...c, ...patch }))
  const setShortNameRule = (rule: ShortNameRule | undefined) =>
    edit((c) => {
      const { shortNameRule: _old, ...rest } = c
      return rule ? { ...rest, shortNameRule: rule } : rest
    })

  /* --------------------------- смысловые блоки --------------------------- */

  function addSection(name: string): void {
    edit((c) => ({
      ...c,
      sections: [...c.sections, { id: uniqueId('s', name, c.sections.map((s) => s.id)), name, order: c.sections.length + 1 }],
    }))
  }

  const updateSection = (id: string, patch: Partial<ClassifierSection>) =>
    edit((c) => ({ ...c, sections: c.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))

  function removeSection(id: string): boolean {
    if (draft.value?.facets.some((f) => f.section === id)) {
      ui.notify('warn', 'В блоке есть фасеты', 'Перенесите их в другой блок')
      return false
    }
    edit((c) => ({ ...c, sections: c.sections.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 })) }))
    return true
  }

  function moveSection(id: string, delta: -1 | 1): void {
    edit((c) => {
      const list = [...c.sections].sort((a, b) => a.order - b.order)
      const i = list.findIndex((s) => s.id === id)
      const j = i + delta
      const a = list[i]
      const b = list[j]
      if (!a || !b) return c
      list[i] = b
      list[j] = a
      return { ...c, sections: list.map((s, k) => ({ ...s, order: k + 1 })) }
    })
  }

  /* ------------------------------- фасеты ------------------------------- */

  function addFacet(name: string): string | null {
    const c = draft.value
    if (!c) return null
    const f = newFacet(c, name)
    edit((x) => ({ ...x, facets: [...x.facets, f] }))
    return f.id
  }

  const updateFacet = (id: string, patch: Partial<FacetConfig>) =>
    edit((c) => ({ ...c, facets: c.facets.map((f) => (f.id === id ? { ...f, ...patch } : f)) }))

  /** Заменить фасет целиком (форма редактирования отдаёт полный объект — так удаляются пустые поля) */
  const replaceFacet = (f: FacetConfig) => edit((c) => ({ ...c, facets: c.facets.map((x) => (x.id === f.id ? f : x)) }))

  function removeFacet(id: string): boolean {
    const c = draft.value
    if (!c) return false
    const used = facetUsage(c, id)
    if (used > 0) {
      ui.notify('warn', 'Фасет используется в структуре', `Удалите его из дерева (нод: ${used})`)
      return false
    }
    // Вместе с фасетом уходят правила, которые на него ссылаются
    edit((x) => ({
      ...x,
      facets: x.facets
        .filter((f) => f.id !== id)
        .map((f) => ({
          ...f,
          dependencies: (f.dependencies ?? [])
            .map((r) => ({ ...r, overrides: r.overrides.filter((o) => o.facetId !== id) }))
            .filter((r) => r.overrides.length > 0),
        })),
    }))
    return true
  }

  const setFacetRules = (facetId: string, rules: FacetDependencyRule[]) =>
    edit((c) => ({ ...c, facets: c.facets.map((f) => (f.id === facetId ? { ...f, dependencies: rules } : f)) }))

  /* ------------------------------- дерево ------------------------------- */

  function addCatalog(name: string): void {
    const c = draft.value
    if (!c) return
    const node = newCatalogNode(c, name)
    edit((x) => ({ ...x, tree: addChild(x.tree, x.tree.id, node) }))
    selectedNodeId.value = node.id
  }

  function addChildNode(parentId: string, facetId: string): void {
    const c = draft.value
    if (!c) return
    const node = newFacetNode(c, facetId)
    edit((x) => ({ ...x, tree: addChild(x.tree, parentId, node) }))
    selectedNodeId.value = node.id
  }

  function deleteNode(id: string): void {
    edit((c) => ({ ...c, tree: removeNode(c.tree, id) }))
    if (selectedNodeId.value === id) selectedNodeId.value = null
  }

  const patchNode = (id: string, patch: Partial<StructureNode>) =>
    edit((c) => ({ ...c, tree: updateNode(c.tree, id, (n) => ({ ...n, ...patch })) }))

  function setNodeCondition(nodeId: string, condition: TransitionCondition | undefined): void {
    edit((c) => ({
      ...c,
      tree: updateNode(c.tree, nodeId, (n) => {
        const { transitionCondition: _old, ...rest } = n
        return condition ? { ...rest, transitionCondition: condition } : rest
      }),
    }))
  }

  const setDecodeStructures = (catalogNodeId: string, list: DecodeStructure[]) =>
    edit((c) => ({ ...c, tree: updateNode(c.tree, catalogNodeId, (n) => ({ ...n, decodeStructures: list })) }))

  /* ------------------------------ сохранение ------------------------------ */

  async function save(): Promise<void> {
    const d = draft.value
    if (!d) return
    if (issues.value.length > 0) {
      ui.notify('warn', 'Конфигурация содержит ошибки', issues.value.map((i) => `${i.where}: ${i.message}`).slice(0, 3).join('\n'))
      return
    }
    saving.value = true
    try {
      await store.saveConfig(cloneConfig(d))
    } finally {
      saving.value = false
    }
  }

  const discard = () => (draft.value = store.classifier ? cloneConfig(store.classifier) : null)

  return {
    draft,
    selectedNodeId,
    selectedNode,
    selectedFacet,
    issues,
    ruleIssues,
    dirty,
    saving,
    setGeneral,
    setShortNameRule,
    addSection,
    updateSection,
    removeSection,
    moveSection,
    addFacet,
    updateFacet,
    replaceFacet,
    removeFacet,
    setFacetRules,
    addCatalog,
    addChildNode,
    deleteNode,
    patchNode,
    setNodeCondition,
    setDecodeStructures,
    save,
    discard,
  }
}
