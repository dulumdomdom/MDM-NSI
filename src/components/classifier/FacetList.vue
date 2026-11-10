<script setup lang="ts">
// Словарь фасетов классификатора: параметры длины, тип, блок, значения, правила, использование в структуре.
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import FacetForm from './FacetForm.vue'
import UiCard from '@/components/ui/UiCard.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPromptDialog from '@/components/ui/UiPromptDialog.vue'
import type { useClassifierConfig } from '@/composables/useClassifierConfig'
import { facetUsage } from '@/lib/classifier'
import type { FacetConfig } from '@/types'

const props = defineProps<{ config: ReturnType<typeof useClassifierConfig> }>()
const cfg = props.config
const draft = computed(() => cfg.draft.value)

const lengthText = (f: FacetConfig): string =>
  f.lengthMode === 'fixed' ? `${f.fixedLength ?? f.defaultLength} симв.` : f.lengthMode === 'delimiter' ? `до «${f.delimiter ?? ''}»` : 'остаток'
const sectionName = (id: string) => draft.value?.sections.find((s) => s.id === id)?.name ?? '—'
const usage = (id: string) => (draft.value ? facetUsage(draft.value, id) : 0)

const addVisible = ref(false)
const formVisible = ref(false)
const editing = ref<FacetConfig | null>(null)

function openEdit(f: FacetConfig): void {
  editing.value = f
  formVisible.value = true
}

function add(name: string): void {
  const id = cfg.addFacet(name)
  const f = draft.value?.facets.find((x) => x.id === id)
  if (f) openEdit(f)
}
</script>

<template>
  <UiCard title="Фасеты" flush>
    <template #actions>
      <Button label="Фасет" icon="pi pi-plus" size="small" text data-testid="facet-add" @click="addVisible = true" />
    </template>
    <UiEmpty v-if="!draft?.facets.length" text="Фасетов пока нет — добавьте первый" />
    <template v-else>
      <div class="grid grid-cols-[1.4fr_110px_1fr_90px_80px_80px_92px] gap-3 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
        <span>Фасет</span><span>Длина</span><span>Блок</span><span>Значений</span><span>Правил</span><span>В дереве</span><span />
      </div>
      <div
        v-for="f in draft.facets"
        :key="f.id"
        class="grid grid-cols-[1.4fr_110px_1fr_90px_80px_80px_92px] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
      >
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-ink">
            {{ f.name }}<span v-if="f.required" class="text-[var(--danger)]"> *</span>
            <span v-if="f.visible === false" class="ml-1 rounded bg-canvas px-1.5 py-0.5 text-2xs text-ink-3">скрыт</span>
          </div>
          <div class="code-font text-2xs text-ink-3">{{ f.id }}</div>
        </div>
        <span class="code-font text-xs text-ink-2">{{ lengthText(f) }}</span>
        <span class="truncate text-sm text-ink-2">{{ sectionName(f.section) }}</span>
        <span class="text-sm text-ink">{{ f.options?.length || '—' }}</span>
        <span class="text-sm text-ink">{{ f.dependencies?.length || '—' }}</span>
        <span class="text-sm" :class="usage(f.id) ? 'text-ink' : 'text-[var(--accent)]'">{{ usage(f.id) || 'нет' }}</span>
        <div class="flex justify-end">
          <Button icon="pi pi-pencil" text rounded size="small" severity="secondary" aria-label="Изменить" @click="openEdit(f)" />
          <Button icon="pi pi-trash" text rounded size="small" severity="secondary" aria-label="Удалить" @click="cfg.removeFacet(f.id)" />
        </div>
      </div>
    </template>

    <UiPromptDialog v-model:visible="addVisible" title="Новый фасет" placeholder="Напр.: Диаметр, мм" submit-label="Добавить" @submit="add" />
    <FacetForm v-if="draft" v-model:visible="formVisible" :facet="editing" :classifier="draft" @save="cfg.replaceFacet" />
  </UiCard>
</template>
