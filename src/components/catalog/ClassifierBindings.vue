<script setup lang="ts">
// Привязка классификаторов к справочнику: элементам присваиваются шифры каждого привязанного классификатора.
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Select from 'primevue/select'
import UiCard from '@/components/ui/UiCard.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import type { useCatalogConfig } from '@/composables/useCatalogConfig'
import type { Classifier } from '@/types'

const props = defineProps<{ config: ReturnType<typeof useCatalogConfig>; classifiers: Classifier[] }>()
const cfg = props.config

const bindings = computed(() => cfg.draft.value?.classifierBindings ?? [])
const available = computed(() => props.classifiers.filter((c) => !bindings.value.some((b) => b.classifierId === c.id)))
const toAdd = ref<string | null>(null)

const classifier = (id: string) => props.classifiers.find((c) => c.id === id)
const catalogsOf = (id: string) => classifier(id)?.tree.children.filter((n) => n.kind === 'catalog') ?? []

function add(): void {
  if (!toAdd.value) return
  cfg.addBinding(toAdd.value, catalogsOf(toAdd.value)[0]?.id)
  toAdd.value = null
}
</script>

<template>
  <UiCard title="Классификаторы элементов" flush>
    <p class="px-4 pt-3 text-sm text-ink-2">
      Каждому элементу справочника можно присвоить шифр каждого привязанного классификатора. Шифр подбирается в карточке элемента и
      проходит согласование по обходному листу «Шифр элемента».
    </p>
    <UiEmpty v-if="bindings.length === 0" text="Классификаторы не привязаны" />
    <div v-else class="mt-3 border-t border-line">
      <div class="grid grid-cols-[1.3fr_1fr_120px_170px_40px] gap-3 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
        <span>Классификатор</span><span>Каталог классификатора</span><span>Обязателен</span><span>Наименование из шифра</span><span />
      </div>
      <div v-for="b in bindings" :key="b.classifierId" class="grid grid-cols-[1.3fr_1fr_120px_170px_40px] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
        <div class="min-w-0">
          <div class="truncate text-sm font-semibold text-ink">{{ classifier(b.classifierId)?.name ?? b.classifierId }}</div>
          <div class="code-font text-2xs text-ink-3">{{ b.classifierId }}</div>
        </div>
        <Select
          :model-value="b.classifierCatalogId ?? null"
          :options="catalogsOf(b.classifierId)"
          option-label="name"
          option-value="id"
          placeholder="Выбирать при присвоении"
          show-clear
          size="small"
          @update:model-value="(v: string | null) => cfg.updateBinding(b.classifierId, { classifierCatalogId: v ?? undefined })"
        />
        <Checkbox :model-value="b.required" binary @update:model-value="(v: boolean) => cfg.updateBinding(b.classifierId, { required: v })" />
        <Checkbox :model-value="!!b.suggestName" binary @update:model-value="(v: boolean) => cfg.updateBinding(b.classifierId, { suggestName: v })" />
        <Button icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Отвязать" @click="cfg.removeBinding(b.classifierId)" />
      </div>
    </div>
    <div class="flex items-center gap-2 border-t border-line px-4 py-3">
      <Select v-model="toAdd" :options="available" option-label="name" option-value="id" placeholder="Привязать классификатор…" size="small" class="w-72" :disabled="available.length === 0" />
      <Button label="Привязать" size="small" outlined :disabled="!toAdd" @click="add" />
    </div>
  </UiCard>
</template>
