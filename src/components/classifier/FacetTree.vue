<script setup lang="ts">
// Дерево структуры шифра: корень → каталоги → ноды фасетов. Текущий путь подсвечен.
// Клик по ноде → store.navigateTree: подставляются значения родителей, чтобы путь прошёл через ноду.
// В редакторе (source) показывает черновик конфигурации, и клик только выбирает ноду.
import { computed, ref, watch } from 'vue'
import Tree from 'primevue/tree'
import type { TreeNode } from 'primevue/treenode'
import { buildTreeNodes, useClassifier, type FacetTreeNode } from '@/composables/useClassifier'
import type { Classifier } from '@/types'

const props = defineProps<{
  /** Режим редактора: клик только выбирает ноду, без навигации по шифру */
  selectOnly?: boolean
  /** Черновик конфигурации для редактора (вместо классификатора сессии) */
  source?: Classifier | null
  selectedKey?: string | null
}>()
const emit = defineEmits<{ select: [nodeId: string] }>()

const { store, treeNodes, expandedKeys, focusField } = useClassifier()

const nodes = computed<FacetTreeNode[]>(() => (props.source ? buildTreeNodes(props.source) : treeNodes.value))

/** В редакторе всё раскрыто — структуру видно целиком */
const allKeys = (list: FacetTreeNode[]): string[] => list.flatMap((n) => [n.key, ...allKeys(n.children)])
const expanded = ref<Record<string, boolean>>({})
watch(
  () => (props.source ? Object.fromEntries(allKeys(nodes.value).map((k) => [k, true])) : expandedKeys.value),
  (k) => (expanded.value = { ...expanded.value, ...k }),
  { immediate: true },
)

const selected = ref<Record<string, boolean>>({})
watch(
  () => props.selectedKey,
  (k) => (selected.value = k ? { [k]: true } : {}),
)

function onSelect(node: TreeNode): void {
  const key = String(node.key)
  emit('select', key)
  if (props.selectOnly) return
  store.navigateTree(key)
  if (store.focusFacetId) void focusField(store.focusFacetId)
}

const data = (node: TreeNode) => (node as FacetTreeNode).data
</script>

<template>
  <Tree
    v-model:expanded-keys="expanded"
    v-model:selection-keys="selected"
    :value="nodes"
    selection-mode="single"
    class="!p-0 text-sm"
    data-testid="facet-tree"
    @node-select="onSelect"
  >
    <template #default="{ node }">
      <span class="flex flex-wrap items-center gap-x-2 gap-y-0.5" :class="data(node).inPath ? 'font-semibold text-brand-dark' : 'text-ink-2'">
        {{ node.label }}
        <span v-if="data(node).condition" class="code-font rounded bg-canvas px-1 text-[11px] text-ink-2">{{ data(node).condition }}</span>
        <span v-if="data(node).isDefault" v-tooltip="'Переход по умолчанию'" class="text-[11px] text-ink-3">★</span>
      </span>
    </template>
  </Tree>
</template>
