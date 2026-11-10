<script setup lang="ts">
// Шаблон обходного листа: какие строки проходит заявка. Строка «Шифрование» достаётся модератору
// своего классификатора, строка «Проверка» — модератору справочника (или классификатора для его записей).
import { onMounted } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import UiCard from '@/components/ui/UiCard.vue'
import { useWorkflowEditor } from '@/composables/useWorkflowEditor'
import { useRequestStore } from '@/stores/request'
import type { RequestTargetType } from '@/types'

const props = defineProps<{
  targetType: RequestTargetType
  targetId: string
  title: string
  description: string
  /** Что может проверять ответственный */
  attributeOptions: { id: string; name: string }[]
  /** Классификаторы для строк шифрования (привязанные к справочнику). Пусто — шифрования в листе нет */
  classifierOptions?: { id: string; name: string }[]
  /** Группы иерархического справочника: строка может действовать только для позиций из них */
  groupOptions?: { id: string; name: string }[]
}>()

const store = useRequestStore()
const wf = useWorkflowEditor(props.targetType, () => props.targetId)

onMounted(() => {
  if (store.roles.length === 0 || store.workflows.length === 0) void store.load()
})

const modes = [
  { value: false, label: 'Параллельно' },
  { value: true, label: 'По порядку' },
]
const classifierName = (id?: string) => props.classifierOptions?.find((c) => c.id === id)?.name ?? id ?? ''

/** Добавить строку шифрования с понятным названием по классификатору */
function addEncode(): void {
  const first = props.classifierOptions?.[0]
  wf.addStep('encode', first?.id)
  const s = wf.draft.value?.steps.at(-1)
  if (s && first) wf.updateStep(s.id, { name: `Шифрование по: ${first.name}` })
}
</script>

<template>
  <UiCard :title="props.title">
    <p class="mb-4 text-sm text-ink-2">{{ props.description }}</p>

    <!-- Своего шаблона нет: показываем, что действует сейчас -->
    <div v-if="!wf.draft.value" class="rounded-md border border-dashed border-line-strong p-4">
      <template v-if="wf.general.value">
        <div class="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Действует общий шаблон</div>
        <ol class="mb-3 flex flex-col gap-1 text-sm">
          <li v-for="s in wf.general.value.steps" :key="s.id" class="flex gap-2">
            <span class="w-5 text-ink-3">{{ s.order }}.</span>
            <span class="text-ink">{{ s.name }}</span>
            <span class="text-ink-3">— {{ store.roleName(s.roleId) }}</span>
          </li>
        </ol>
      </template>
      <p v-else class="mb-3 text-sm text-ink-2">Обходного листа нет: изменения применяются сразу.</p>
      <Button label="Настроить свой обходной лист" icon="pi pi-pencil" size="small" outlined @click="wf.customize" />
    </div>

    <!-- Редактор -->
    <div v-else class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm text-ink-2">Порядок прохождения строк</span>
        <SelectButton :model-value="wf.draft.value.sequential" :options="modes" option-label="label" option-value="value" :allow-empty="false" @update:model-value="wf.setSequential" />
      </div>

      <div class="overflow-hidden rounded-md border border-line">
        <div class="grid grid-cols-[32px_1.4fr_1fr_1.2fr_90px_92px] gap-3 border-b border-line bg-brand-soft px-3 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
          <span>№</span><span>Строка</span><span>Роль</span><span>Классификатор / атрибуты</span><span>Необяз.</span><span />
        </div>
        <div v-if="wf.draft.value.steps.length === 0" class="px-3 py-4 text-sm text-ink-3">Добавьте хотя бы одну строку</div>
        <div
          v-for="(s, i) in wf.draft.value.steps"
          :key="s.id"
          class="grid grid-cols-[32px_1.4fr_1fr_1.2fr_90px_92px] items-center gap-3 border-b border-line px-3 py-2 last:border-b-0"
        >
          <span class="text-sm font-bold text-brand-dark">{{ s.order }}</span>
          <div class="flex flex-col gap-1">
            <span class="text-2xs font-semibold uppercase tracking-[0.06em]" :class="s.kind === 'encode' ? 'text-brand' : 'text-ink-3'">
              {{ s.kind === 'encode' ? 'Шифрование' : 'Проверка' }}
            </span>
            <InputText :model-value="s.name" placeholder="Что делает ответственный" size="small" :invalid="!s.name.trim()" @update:model-value="(v) => wf.updateStep(s.id, { name: v ?? '' })" />
          </div>
          <Select
            :model-value="s.roleId || null"
            :options="store.roles"
            option-label="name"
            option-value="id"
            placeholder="Роль"
            size="small"
            :invalid="!s.roleId"
            @update:model-value="(v: string) => wf.updateStep(s.id, { roleId: v })"
          />
          <Select
            v-if="s.kind === 'encode'"
            :model-value="s.classifierId ?? null"
            :options="props.classifierOptions ?? []"
            option-label="name"
            option-value="id"
            placeholder="Классификатор"
            size="small"
            :invalid="!s.classifierId"
            @update:model-value="(v: string) => wf.updateStep(s.id, { classifierId: v, name: `Шифрование по: ${classifierName(v)}` })"
          />
          <MultiSelect
            v-else
            :model-value="s.attributeIds"
            :options="props.attributeOptions"
            option-label="name"
            option-value="id"
            placeholder="—"
            display="comma"
            size="small"
            :max-selected-labels="2"
            @update:model-value="(v: string[]) => wf.updateStep(s.id, { attributeIds: v })"
          />
          <span>
            <Checkbox
              v-if="s.kind === 'encode'"
              v-tooltip.top="'Модератор может отметить «не применимо»'"
              :model-value="!!s.optional"
              binary
              @update:model-value="(v: boolean) => wf.updateStep(s.id, { optional: v })"
            />
          </span>
          <div class="flex justify-end">
            <Button icon="pi pi-arrow-up" text rounded size="small" severity="secondary" :disabled="i === 0" aria-label="Выше" @click="wf.moveStep(s.id, -1)" />
            <Button icon="pi pi-arrow-down" text rounded size="small" severity="secondary" :disabled="i === wf.draft.value.steps.length - 1" aria-label="Ниже" @click="wf.moveStep(s.id, 1)" />
            <Button icon="pi pi-times" text rounded size="small" severity="secondary" aria-label="Удалить строку" @click="wf.removeStep(s.id)" />
          </div>
          <!-- Условия строки: для каких групп и в какой срок -->
          <div class="col-span-full -mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 pb-1 pl-[44px] text-xs text-ink-2">
            <label v-if="props.groupOptions?.length" class="flex items-center gap-2">
              Только для групп
              <MultiSelect
                :model-value="s.groupIds ?? []"
                :options="props.groupOptions"
                option-label="name"
                option-value="id"
                placeholder="все позиции"
                display="chip"
                size="small"
                class="min-w-[220px]"
                :aria-label="`Группы для строки ${s.order}`"
                @update:model-value="(v: string[]) => wf.updateStep(s.id, { groupIds: v })"
              />
            </label>
            <label class="flex items-center gap-2">
              Срок, ч
              <InputNumber
                :model-value="s.dueHours ?? null"
                :min="1"
                :max="720"
                size="small"
                input-class="!w-16"
                placeholder="—"
                :aria-label="`Срок строки ${s.order}`"
                @update:model-value="(v: number | null) => wf.updateStep(s.id, { dueHours: v ?? undefined })"
              />
            </label>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex gap-1">
          <Button v-if="props.classifierOptions?.length" label="Шифрование" icon="pi pi-plus" size="small" text @click="addEncode" />
          <Button label="Проверка" icon="pi pi-plus" size="small" text @click="wf.addStep('review')" />
        </div>
        <div class="flex gap-2">
          <Button :label="wf.general.value ? 'Вернуть общий шаблон' : 'Отключить согласование'" severity="secondary" text size="small" @click="wf.reset" />
          <Button label="Сохранить" icon="pi pi-check" size="small" :disabled="!wf.dirty.value || !wf.valid.value || wf.draft.value.steps.length === 0" @click="wf.save" />
        </div>
      </div>
    </div>
  </UiCard>
</template>
