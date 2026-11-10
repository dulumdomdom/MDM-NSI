<script setup lang="ts">
// Дерево структуры шифра: каталоги, ноды фасетов, ветвление по условиям, ветка по умолчанию.
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import ConditionEditor from './ConditionEditor.vue'
import FacetTree from './FacetTree.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiPromptDialog from '@/components/ui/UiPromptDialog.vue'
import type { useClassifierConfig } from '@/composables/useClassifierConfig'
import { formatCondition, pathToNode } from '@/lib/classifier'
import type { StructureNode } from '@/types'

const props = defineProps<{ config: ReturnType<typeof useClassifierConfig> }>()
const cfg = props.config
const draft = computed(() => cfg.draft.value)
const node = computed(() => cfg.selectedNode.value)

const parent = computed<StructureNode | null>(() => {
  if (!draft.value || !node.value) return null
  const path = pathToNode(draft.value.tree, node.value.id)
  return path && path.length > 1 ? (path[path.length - 2] ?? null) : null
})

const facetName = (id?: string) => draft.value?.facets.find((f) => f.id === id)?.name ?? id ?? ''
const nodeLabel = (n: StructureNode) => (n.kind === 'facet' ? facetName(n.facetId) : n.name)
const KIND: Record<StructureNode['kind'], string> = { root: 'Корень', catalog: 'Каталог', facet: 'Фасет' }

/** Нельзя добавлять детей после фасета, забирающего остаток шифра */
const canAddChild = computed(() => {
  const n = node.value
  if (!n || n.kind === 'root') return false
  return draft.value?.facets.find((f) => f.id === n.facetId)?.lengthMode !== 'remainder'
})

const childFacet = ref<string | null>(null)
function addChild(): void {
  if (!node.value || !childFacet.value) return
  cfg.addChildNode(node.value.id, childFacet.value)
  childFacet.value = null
}

const catalogVisible = ref(false)
</script>

<template>
  <div v-if="draft" class="grid grid-cols-1 gap-5 xl:grid-cols-[400px_1fr]">
    <UiCard title="Структура">
      <template #actions>
        <Button label="Каталог" icon="pi pi-plus" size="small" text @click="catalogVisible = true" />
      </template>
      <FacetTree select-only :source="draft" :selected-key="cfg.selectedNodeId.value" @select="(id) => (cfg.selectedNodeId.value = id)" />
    </UiCard>

    <div class="flex flex-col gap-5">
      <UiCard v-if="!node" title="Как устроена структура">
        <ul class="flex list-inside list-disc flex-col gap-1.5 text-sm text-ink-2">
          <li>Корень делится на каталоги; в каталоге — цепочка нод, каждая читает один фасет шифра.</li>
          <li>Если у ноды несколько дочерних, переход выбирается по <b>условию</b>: значение фасета ноды сравнивается с условием ребёнка.</li>
          <li>Если ни одно условие не выполнено — берётся <b>ветка по умолчанию</b> (★).</li>
          <li>Выберите ноду слева, чтобы настроить её.</li>
        </ul>
      </UiCard>

      <template v-else>
        <UiCard :title="`${KIND[node.kind]}: ${nodeLabel(node)}`">
          <template #actions>
            <Button v-if="node.kind !== 'root'" label="Удалить" icon="pi pi-trash" size="small" severity="danger" text @click="cfg.deleteNode(node.id)" />
          </template>
          <div class="flex flex-col gap-4">
            <label v-if="node.kind === 'catalog'" class="flex flex-col gap-1.5">
              <span class="text-xs font-medium text-ink-2">Наименование каталога</span>
              <InputText :model-value="node.name" @update:model-value="(v) => cfg.patchNode(node!.id, { name: v ?? '' })" />
            </label>
            <label v-if="node.kind === 'facet'" class="flex flex-col gap-1.5">
              <span class="text-xs font-medium text-ink-2">Фасет ноды</span>
              <Select
                :model-value="node.facetId"
                :options="draft.facets"
                option-label="name"
                option-value="id"
                class="max-w-sm"
                @update:model-value="(v: string) => cfg.patchNode(node!.id, { facetId: v })"
              />
            </label>

            <!-- Условие перехода в эту ноду -->
            <div v-if="parent && parent.kind === 'facet'">
              <div class="mb-1.5 text-xs font-medium text-ink-2">
                Переход сюда, если значение фасета «{{ facetName(parent.facetId) }}» удовлетворяет условию
              </div>
              <ConditionEditor :model-value="node.transitionCondition" @update:model-value="(c) => cfg.setNodeCondition(node!.id, c)" />
            </div>
          </div>
        </UiCard>

        <UiCard v-if="node.kind !== 'root' || node.children.length" title="Дальше по шифру" flush>
          <div v-if="node.children.length === 0" class="px-4 py-3 text-sm text-ink-3">Это последняя нода ветки.</div>
          <div v-for="(ch, i) in node.children" :key="ch.id" class="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <label v-if="node.children.length > 1" v-tooltip.top="'Ветка по умолчанию'" class="flex items-center">
              <input
                type="radio"
                :name="`default-${node.id}`"
                :checked="node.defaultChildIndex === i"
                class="accent-[var(--brand)]"
                @change="cfg.patchNode(node!.id, { defaultChildIndex: i })"
              />
            </label>
            <button type="button" class="min-w-0 flex-1 text-left" @click="cfg.selectedNodeId.value = ch.id">
              <span class="text-sm font-semibold text-ink hover:text-brand">{{ nodeLabel(ch) }}</span>
              <span v-if="ch.transitionCondition" class="code-font ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-2xs text-brand-dark">
                {{ formatCondition(ch.transitionCondition) }}
              </span>
              <span v-else-if="node.children.length > 1" class="ml-2 text-2xs text-[var(--accent)]">без условия</span>
            </button>
            <span v-if="node.children.length > 1 && node.defaultChildIndex === i" class="text-2xs text-ink-3">по умолчанию</span>
          </div>
          <div v-if="canAddChild" class="flex items-center gap-2 border-t border-line px-4 py-3">
            <Select v-model="childFacet" :options="draft.facets" option-label="name" option-value="id" placeholder="Фасет следующей ноды…" size="small" filter class="w-72" />
            <Button label="Добавить" size="small" outlined :disabled="!childFacet" @click="addChild" />
          </div>
        </UiCard>
      </template>
    </div>

    <UiPromptDialog v-model:visible="catalogVisible" title="Новый каталог классификатора" placeholder="Напр.: Измерительный инструмент" submit-label="Добавить" @submit="cfg.addCatalog" />
  </div>
</template>
