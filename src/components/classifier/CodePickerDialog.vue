<script setup lang="ts">
// Подбор шифра классификатора в диалоге: отдельная сессия ввода (provide) — те же поле шифра,
// список фасетов и расшифровка, что на странице классификатора. Что делать с шифром, решает родитель
// (pick): присвоить элементу, закрыть строку заявки. Ошибку сервера (напр. дубликат) показываем здесь же.
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Select from 'primevue/select'
import CodeInput from './CodeInput.vue'
import DecodePanel from './DecodePanel.vue'
import FacetWizard from './FacetWizard.vue'
import { provideClassifierSession } from '@/composables/useClassifierSession'
import { useCatalogStore } from '@/stores/catalog'
import type { StepCode } from '@/types'

const props = defineProps<{
  classifierId: string | null
  /** Что шифруем — подпись в заголовке */
  subject: string
  /** Каталог классификатора: подсказка или жёсткий выбор (lockCatalog) */
  catalogId?: string
  lockCatalog?: boolean
  /** Текущий шифр (переприсвоение) */
  initialCode?: string
  /** Предложить «наименование = краткое наименование шифра» */
  suggestName?: boolean
  submitLabel?: string
  /** Действие с подобранным шифром; вернуть текст ошибки или null */
  pick: (code: StepCode, useAsName: boolean) => Promise<string | null>
}>()
const visible = defineModel<boolean>('visible', { required: true })

const catalogStore = useCatalogStore()
const session = provideClassifierSession()

const loading = ref(false)
const error = ref('')
const useAsName = ref(false)

// При открытии: свежий конфиг классификатора, каталог, текущий шифр
watch(visible, async (v) => {
  if (!v || !props.classifierId) return
  error.value = ''
  useAsName.value = !!props.suggestName && !props.initialCode
  loading.value = true
  try {
    const c = await catalogStore.freshClassifier(props.classifierId)
    session.setClassifier(c, props.catalogId)
    if (props.initialCode) session.setCode(props.initialCode)
  } finally {
    loading.value = false
  }
})

const unchanged = computed(() => !!props.initialCode && props.initialCode === session.parseResult?.code)

async function submit(): Promise<void> {
  const r = session.parseResult
  if (!props.classifierId || !r || !session.canSubmit) return
  session.saving = true
  error.value = ''
  try {
    const err = await props.pick(
      { classifierId: props.classifierId, catalogId: session.catalogId, code: r.code, decoded: session.decodedString, shortName: session.shortName },
      useAsName.value && !!session.shortName,
    )
    if (err) error.value = err
    else visible.value = false
  } finally {
    session.saving = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal class="w-full max-w-6xl" :draggable="false" :content-style="{ paddingBottom: '0' }">
    <template #header>
      <div class="min-w-0">
        <div class="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">Шифр классификатора</div>
        <div class="truncate text-lg font-extrabold text-brand-dark">{{ session.classifier?.name ?? '…' }}</div>
        <div class="truncate text-sm text-ink-2">для «{{ props.subject }}»</div>
      </div>
    </template>

    <div v-if="loading || !session.classifier" class="py-16 text-center text-sm text-ink-3">Загрузка конфигурации классификатора…</div>
    <div v-else class="flex flex-col gap-4 pb-4" data-testid="code-assign">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span class="text-sm text-ink-2">
          Введите шифр строкой или выберите значения фасетов — обе части синхронны.
          <template v-if="props.initialCode"> Текущий шифр будет заменён.</template>
        </span>
        <Select
          :model-value="session.catalogId"
          :options="session.catalogs"
          option-label="name"
          option-value="id"
          :disabled="props.lockCatalog"
          size="small"
          class="w-60"
          aria-label="Каталог классификатора"
          @update:model-value="(v: string) => session.selectCatalog(v)"
        />
      </div>

      <CodeInput :editable="session.availableModes.includes('direct')" />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div class="max-h-[52vh] min-w-0 overflow-auto">
          <FacetWizard :readonly="!session.availableModes.includes('wizard')" />
        </div>
        <DecodePanel />
      </div>

      <Message v-if="error" severity="error" :closable="false" data-testid="assign-error">{{ error }}</Message>
    </div>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-3">
        <label v-if="props.suggestName" class="flex items-center gap-2 text-sm text-ink-2">
          <Checkbox v-model="useAsName" binary :disabled="!session.shortName" />
          Наименование = «{{ session.shortName || 'краткое наименование' }}»
        </label>
        <span v-else />
        <div class="flex gap-2">
          <Button label="Отмена" severity="secondary" text @click="visible = false" />
          <Button
            :label="props.submitLabel ?? 'Присвоить'"
            icon="pi pi-check"
            :disabled="!session.canSubmit || unchanged"
            :loading="session.saving"
            data-testid="assign-submit"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </Dialog>
</template>
