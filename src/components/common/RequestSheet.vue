<script setup lang="ts">
// Карточка заявки (обходной лист): что предлагается и кто что сделал.
// Свою строку ответственный закрывает здесь же: шифрует своим классификатором, отмечает «не применимо»,
// согласует или отклоняет (с причиной).
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Textarea from 'primevue/textarea'
import CodePickerDialog from '@/components/classifier/CodePickerDialog.vue'
import { catalogApi } from '@/api'
import { formatAttribute } from '@/lib/attributes'
import { isOverdue } from '@/lib/rbac'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'
import { progress, TARGET_LABELS, useRequestStore } from '@/stores/request'
import type { Catalog, Request, RequestStep, RequestStepStatus, StepCode } from '@/types'

const props = defineProps<{ request: Request }>()

const auth = useAuthStore()
const store = useRequestStore()
const catalogStore = useCatalogStore()

const dt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
const p = computed(() => progress(props.request))

/** Схема справочника — подписи атрибутов и привязки классификаторов */
const catalog = ref<Catalog | null>(null)
async function loadCatalog(): Promise<void> {
  const r = props.request
  catalog.value = null
  if (r.targetType === 'classifier-entry') return
  try {
    catalog.value = await catalogApi.get(r.targetId)
    await catalogStore.loadClassifiers(catalog.value.classifierBindings.map((b) => b.classifierId))
  } catch {
    /* без схемы покажем значения как есть */
  }
}
onMounted(loadCatalog)
watch(() => props.request.id, loadCatalog)

/** «осталось 5 ч» / «просрочено на 2 д» */
function dueText(iso: string): string {
  const ms = Date.parse(iso) - Date.now()
  const h = Math.round(Math.abs(ms) / 3_600_000)
  const span = h >= 48 ? `${Math.round(h / 24)} д` : `${Math.max(h, 1)} ч`
  return ms < 0 ? `просрочено на ${span}` : `осталось ${span}`
}

const classifierName = (id?: string) => (id ? (catalogStore.classifiers[id]?.name ?? id) : '')

const STEP: Record<RequestStepStatus, { label: string; cls: string; icon: string }> = {
  pending: { label: 'Ожидает', cls: 'text-ink-3', icon: 'pi pi-clock' },
  approved: { label: 'Выполнено', cls: 'text-emerald-700', icon: 'pi pi-check' },
  rejected: { label: 'Отклонено', cls: 'text-red-700', icon: 'pi pi-times' },
  skipped: { label: 'Не применимо', cls: 'text-ink-3', icon: 'pi pi-minus' },
}

/** Предлагаемые значения атрибутов: все (пополнение) или изменённые (корректировка) */
const proposed = computed(() => {
  const attrs = props.request.payload.attributes ?? {}
  return Object.entries(attrs)
    .map(([id, value]) => {
      const a = catalog.value?.attributes.find((x) => x.id === id)
      return { id, label: a?.name ?? id, text: a ? formatAttribute(a, value) : String(typeof value === 'object' ? JSON.stringify(value) : (value ?? '')) }
    })
    .filter((row) => row.text !== '')
})

const comments = ref<Record<string, string>>({})
const rejecting = ref<string | null>(null)

async function decide(step: RequestStep, decision: 'approved' | 'rejected' | 'skipped'): Promise<void> {
  const comment = comments.value[step.id]?.trim()
  if (decision === 'rejected' && !comment) return
  const err = await store.decide(props.request.id, step.id, { decision, ...(comment ? { comment } : {}) })
  if (err) store.notifyError(err)
  else rejecting.value = null
}

/* Шифрование строки */
const pickerVisible = ref(false)
const pickerStep = ref<RequestStep | null>(null)
const bindingOf = (classifierId?: string) => catalog.value?.classifierBindings.find((b) => b.classifierId === classifierId)

function openEncode(step: RequestStep): void {
  pickerStep.value = step
  pickerVisible.value = true
}

async function pickCode(code: StepCode): Promise<string | null> {
  const step = pickerStep.value
  if (!step) return 'Строка не выбрана'
  const comment = comments.value[step.id]?.trim()
  return store.decide(props.request.id, step.id, { decision: 'approved', code, ...(comment ? { comment } : {}) })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <div class="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">{{ TARGET_LABELS[props.request.targetType] }} · № {{ props.request.id }}</div>
      <h2 class="mt-1 text-xl font-extrabold leading-tight text-brand-dark">{{ props.request.title }}</h2>
      <div class="mt-1 text-sm text-ink-2">
        {{ store.personName(props.request.createdBy) }} · {{ dt.format(new Date(props.request.createdAt)) }}
        <template v-if="catalog"> · {{ catalog.name }}</template>
      </div>
    </div>

    <!-- Что предлагается -->
    <section class="rounded-lg bg-canvas/70 p-4 text-sm">
      <p v-if="props.request.payload.query" class="mb-3 text-xs text-ink-3">
        Искали: <span class="text-ink-2">«{{ props.request.payload.query }}»</span>
      </p>
      <div v-if="proposed.length" class="mb-1 text-2xs font-bold uppercase tracking-[0.06em] text-ink-3">
        {{ props.request.targetType === 'element-edit' ? 'Новые значения' : 'Данные позиции' }}
      </div>
      <dl v-if="proposed.length" class="grid grid-cols-[150px_1fr] gap-x-4 gap-y-1.5">
        <template v-for="row in proposed" :key="row.id">
          <dt class="text-ink-3">{{ row.label }}</dt>
          <dd class="text-ink">{{ row.text }}</dd>
        </template>
      </dl>
      <p v-if="props.request.payload.recode?.length" class="mt-3 text-xs text-[var(--accent)]">
        Требуется перешифровка: {{ props.request.payload.recode.map(classifierName).join(', ') }}
      </p>
      <dl v-if="props.request.payload.code" class="grid grid-cols-[150px_1fr] gap-x-4 gap-y-1.5">
        <dt class="text-ink-3">Шифр</dt>
        <dd class="code-font font-semibold text-brand-dark">{{ props.request.payload.code }}</dd>
        <dt class="text-ink-3">Расшифровка</dt>
        <dd class="text-ink">{{ props.request.payload.decoded }}</dd>
      </dl>
    </section>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="text-sm font-bold text-brand-dark">Обходной лист</h3>
        <span class="text-xs text-ink-3">{{ props.request.sequential ? 'по порядку' : 'параллельно' }} · выполнено {{ p.done }} из {{ p.total }}</span>
      </div>
      <div class="mb-4 flex gap-1">
        <span
          v-for="s in props.request.steps"
          :key="s.id"
          class="h-1.5 flex-1 rounded-full"
          :class="s.status === 'approved' ? 'bg-emerald-500' : s.status === 'rejected' ? 'bg-red-500' : s.status === 'skipped' ? 'bg-line-strong' : 'bg-line'"
        />
      </div>

      <ol class="overflow-hidden rounded-lg border border-line">
        <li v-for="s in props.request.steps" :key="s.id" class="border-b border-line px-4 py-3.5 last:border-b-0" :data-testid="`step-${s.id}`">
          <div class="flex items-start gap-3">
            <span
              class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold"
              :class="s.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : s.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-brand-soft text-brand-dark'"
            >
              <i v-if="s.status !== 'pending'" :class="STEP[s.status].icon" class="text-[11px]" />
              <template v-else>{{ s.order }}</template>
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <span class="text-sm font-semibold text-ink">{{ s.name }}</span>
                <span class="text-xs font-medium" :class="STEP[s.status].cls">{{ STEP[s.status].label }}</span>
              </div>
              <div class="text-xs text-ink-3">
                {{ store.roleName(s.roleId) }}<template v-if="s.kind === 'encode'"> классификатора «{{ classifierName(s.classifierId) }}»</template>
                <template v-if="s.decidedBy"> · {{ store.personName(s.decidedBy) }}<template v-if="s.onBehalfOf"> за {{ store.personName(s.onBehalfOf) }}</template>, {{ dt.format(new Date(s.decidedAt ?? '')) }}</template>
              </div>
              <div v-if="s.status === 'pending' && s.dueAt" class="mt-1 flex items-center gap-1.5 text-xs" :data-testid="`due-${s.id}`">
                <i class="pi pi-stopwatch text-[11px]" :class="isOverdue(s) ? 'text-[var(--danger)]' : 'text-ink-3'" />
                <span :class="isOverdue(s) ? 'font-semibold text-[var(--danger)]' : 'text-ink-3'">срок {{ dt.format(new Date(s.dueAt)) }} · {{ dueText(s.dueAt) }}</span>
              </div>
              <div v-if="s.result" class="mt-1.5 rounded bg-brand-soft/60 px-2.5 py-1.5">
                <div class="code-font text-sm font-semibold text-brand-dark">{{ s.result.code }}</div>
                <div class="text-xs text-ink-2">{{ s.result.decoded }}</div>
              </div>
              <p v-if="s.comment" class="mt-1.5 rounded bg-canvas px-2.5 py-1.5 text-sm text-ink-2">{{ s.comment }}</p>

              <!-- Работа со строкой -->
              <div v-if="auth.canDecide(props.request, s)" class="mt-3 flex flex-col gap-2">
                <div v-if="auth.decidesFor(props.request, s)" class="flex items-center gap-1.5 rounded-sm bg-amber-50 px-2 py-1 text-xs text-[var(--accent)]">
                  <i class="pi pi-user-edit text-[11px]" />Решение за {{ store.personName(auth.decidesFor(props.request, s) ?? '') }} — вы замещаете
                </div>
                <Textarea
                  v-model="comments[s.id]"
                  rows="1"
                  auto-resize
                  :placeholder="rejecting === s.id ? 'Причина отклонения (обязательно)' : 'Комментарий (необязательно)'"
                  :invalid="rejecting === s.id && !comments[s.id]?.trim()"
                  class="text-sm"
                />
                <div class="flex flex-wrap gap-2">
                  <template v-if="rejecting !== s.id">
                    <template v-if="s.kind === 'encode'">
                      <Button label="Зашифровать" icon="pi pi-sitemap" size="small" :data-testid="`encode-${s.id}`" @click="openEncode(s)" />
                      <Button v-if="s.optional" label="Не применимо" size="small" severity="secondary" outlined :data-testid="`skip-${s.id}`" @click="decide(s, 'skipped')" />
                    </template>
                    <Button v-else label="Согласовать" icon="pi pi-check" size="small" :data-testid="`approve-${s.id}`" @click="decide(s, 'approved')" />
                    <Button label="Отклонить" size="small" severity="danger" text @click="rejecting = s.id" />
                  </template>
                  <template v-else>
                    <Button label="Отклонить заявку" icon="pi pi-times" size="small" severity="danger" :disabled="!comments[s.id]?.trim()" @click="decide(s, 'rejected')" />
                    <Button label="Отмена" size="small" severity="secondary" text @click="rejecting = null" />
                  </template>
                </div>
              </div>
            </div>
          </div>
        </li>
      </ol>
    </section>

    <CodePickerDialog
      v-model:visible="pickerVisible"
      :classifier-id="pickerStep?.classifierId ?? null"
      :subject="props.request.payload.name ?? props.request.title"
      :catalog-id="bindingOf(pickerStep?.classifierId)?.classifierCatalogId"
      :lock-catalog="!!bindingOf(pickerStep?.classifierId)?.classifierCatalogId"
      submit-label="Зашифровать"
      :pick="pickCode"
    />
  </div>
</template>
