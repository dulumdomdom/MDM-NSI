<script setup lang="ts">
// Общие свойства классификатора и смысловые блоки (секции фасетов).
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import UiCard from '@/components/ui/UiCard.vue'
import UiField from '@/components/ui/UiField.vue'
import UiPromptDialog from '@/components/ui/UiPromptDialog.vue'
import type { useClassifierConfig } from '@/composables/useClassifierConfig'
import type { ClassifierInputMode, ReadDirection } from '@/types'

const props = defineProps<{ config: ReturnType<typeof useClassifierConfig> }>()
const cfg = props.config
const draft = computed(() => cfg.draft.value)
const sections = computed(() => [...(draft.value?.sections ?? [])].sort((a, b) => a.order - b.order))
const facetCount = (sectionId: string) => draft.value?.facets.filter((f) => f.section === sectionId).length ?? 0

const directions: { value: ReadDirection; label: string }[] = [
  { value: 'rtl', label: 'Справа налево' },
  { value: 'ltr', label: 'Слева направо' },
]
const MODES: { value: ClassifierInputMode; label: string; hint: string }[] = [
  { value: 'direct', label: 'Строкой', hint: 'шифр вводится целиком в поле' },
  { value: 'wizard', label: 'По фасетам', hint: 'значения выбираются в списке фасетов' },
]

function toggleMode(m: ClassifierInputMode, on: boolean): void {
  const cur = draft.value?.inputModes ?? []
  cfg.setGeneral({ inputModes: on ? [...new Set([...cur, m])] : cur.filter((x) => x !== m) })
}

const sectionVisible = ref(false)
</script>

<template>
  <div v-if="draft" class="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1fr]">
    <UiCard title="Свойства">
      <div class="grid grid-cols-1 gap-4">
        <UiField label="Наименование" for-id="cg-name" required>
          <InputText id="cg-name" :model-value="draft.name" fluid @update:model-value="(v) => cfg.setGeneral({ name: v ?? '' })" />
        </UiField>
        <UiField label="Описание" for-id="cg-desc">
          <Textarea id="cg-desc" :model-value="draft.description ?? ''" rows="2" auto-resize fluid @update:model-value="(v) => cfg.setGeneral({ description: v })" />
        </UiField>
        <UiField label="Направление чтения шифра">
          <SelectButton
            :model-value="draft.readDirection"
            :options="directions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            @update:model-value="(v: ReadDirection) => cfg.setGeneral({ readDirection: v })"
          />
        </UiField>
        <UiField label="Способы ввода шифра">
          <div class="flex flex-col gap-2">
            <label v-for="m in MODES" :key="m.value" class="flex items-center gap-2 text-sm">
              <Checkbox :model-value="draft.inputModes.includes(m.value)" binary @update:model-value="(v: boolean) => toggleMode(m.value, v)" />
              <b class="font-semibold text-ink">{{ m.label }}</b><span class="text-ink-3">— {{ m.hint }}</span>
            </label>
          </div>
        </UiField>
        <UiField label="Допустимые символы (регулярное выражение для одного символа)" for-id="cg-chars" hint="По умолчанию буквы и цифры: [\p{L}\p{N}]">
          <InputText
            id="cg-chars"
            :model-value="draft.allowedCharsPattern ?? ''"
            placeholder="[\p{L}\p{N}]"
            class="code-font"
            fluid
            @update:model-value="(v) => cfg.setGeneral({ allowedCharsPattern: v || undefined })"
          />
        </UiField>
      </div>
    </UiCard>

    <UiCard title="Смысловые блоки" flush>
      <template #actions>
        <Button label="Блок" icon="pi pi-plus" size="small" text @click="sectionVisible = true" />
      </template>
      <p class="px-4 pt-3 text-xs text-ink-3">Группы фасетов в форме ввода. Порядок блоков — порядок показа.</p>
      <div class="mt-2">
        <div v-for="(s, i) in sections" :key="s.id" class="flex items-center gap-2 border-t border-line px-4 py-2">
          <span class="w-5 text-sm font-bold text-brand-dark">{{ s.order }}</span>
          <InputText :model-value="s.name" size="small" class="flex-1" @update:model-value="(v) => cfg.updateSection(s.id, { name: v ?? '' })" />
          <span class="w-20 text-right text-xs text-ink-3">{{ facetCount(s.id) }} фас.</span>
          <Button icon="pi pi-arrow-up" text rounded size="small" severity="secondary" :disabled="i === 0" aria-label="Выше" @click="cfg.moveSection(s.id, -1)" />
          <Button icon="pi pi-arrow-down" text rounded size="small" severity="secondary" :disabled="i === sections.length - 1" aria-label="Ниже" @click="cfg.moveSection(s.id, 1)" />
          <Button icon="pi pi-trash" text rounded size="small" severity="secondary" aria-label="Удалить блок" @click="cfg.removeSection(s.id)" />
        </div>
      </div>
    </UiCard>

    <UiPromptDialog v-model:visible="sectionVisible" title="Новый смысловой блок" placeholder="Напр.: Геометрия" submit-label="Добавить" @submit="cfg.addSection" />
  </div>
</template>
