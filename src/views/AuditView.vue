<script setup lang="ts">
// Журнал действий: кто, что и когда изменил. Видят администратор, руководитель службы НСИ и аудитор.
import { computed, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { adminApi, auditApi, errorMessage } from '@/api'
import type { UserBrief } from '@/api/auth'
import { csvName, downloadText, toCsv } from '@/lib/csv'
import { useUiStore } from '@/stores/ui'
import type { AuditEntry, AuditObjectType } from '@/types'

const ui = useUiStore()

const TYPES: Record<AuditObjectType, { label: string; icon: string }> = {
  session: { label: 'Вход', icon: 'pi pi-sign-in' },
  element: { label: 'Элемент', icon: 'pi pi-box' },
  catalog: { label: 'Справочник', icon: 'pi pi-book' },
  classifier: { label: 'Классификатор', icon: 'pi pi-sitemap' },
  request: { label: 'Заявка', icon: 'pi pi-inbox' },
  user: { label: 'Пользователь', icon: 'pi pi-user' },
  role: { label: 'Роль', icon: 'pi pi-shield' },
  integration: { label: 'Интеграция', icon: 'pi pi-arrow-right-arrow-left' },
}
const typeOptions = (Object.keys(TYPES) as AuditObjectType[]).map((t) => ({ value: t, label: TYPES[t].label }))

const rows = ref<AuditEntry[]>([])
const people = ref<UserBrief[]>([])
const loading = ref(false)
const userId = ref<string | null>(null)
const objectType = ref<AuditObjectType | null>(null)
const q = ref('')

const person = (id: string) => people.value.find((p) => p.id === id)

async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await auditApi.list({
      ...(userId.value ? { userId: userId.value } : {}),
      ...(objectType.value ? { objectType: objectType.value } : {}),
      ...(q.value.trim() ? { q: q.value.trim() } : {}),
    })
  } catch (e) {
    ui.notify('error', 'Журнал недоступен', errorMessage(e))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  people.value = await adminApi.directory()
  await load()
})
watch([userId, objectType], () => void load())
let timer: ReturnType<typeof setTimeout> | undefined
watch(q, () => {
  clearTimeout(timer)
  timer = setTimeout(() => void load(), 300)
})

const dt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Группировка по дням — журнал читается как сменный */
const days = computed(() => {
  const out: { day: string; items: AuditEntry[] }[] = []
  const dayFmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
  for (const r of rows.value) {
    const day = dayFmt.format(new Date(r.at))
    const last = out.at(-1)
    if (last?.day === day) last.items.push(r)
    else out.push({ day, items: [r] })
  }
  return out
})

function exportCsv(): void {
  const csv = toCsv(rows.value, [
    { title: 'Дата и время', value: (r) => dt.format(new Date(r.at)) },
    { title: 'Пользователь', value: (r) => person(r.userId)?.fullName ?? r.userId },
    { title: 'Действие', value: (r) => r.action },
    { title: 'Тип объекта', value: (r) => TYPES[r.objectType].label },
    { title: 'Объект', value: (r) => r.objectName ?? r.objectId ?? '' },
    { title: 'Подробности', value: (r) => r.details ?? '' },
  ])
  downloadText(csvName('Журнал_действий'), csv)
}
</script>

<template>
  <div>
    <UiPageHeader title="Журнал действий" subtitle="Кто, что и когда изменил: входы, данные справочников, заявки, права, обмен">
      <template #actions>
        <Button label="Выгрузить CSV" icon="pi pi-download" severity="secondary" outlined :disabled="rows.length === 0" data-testid="audit-export" @click="exportCsv" />
      </template>
    </UiPageHeader>

    <div class="mb-4 flex flex-wrap gap-3">
      <Select v-model="userId" :options="people" option-label="fullName" option-value="id" placeholder="Все пользователи" show-clear filter class="w-64" aria-label="Пользователь" />
      <Select v-model="objectType" :options="typeOptions" option-label="label" option-value="value" placeholder="Все объекты" show-clear class="w-48" aria-label="Тип объекта" />
      <IconField class="min-w-[16rem] flex-1">
        <InputIcon class="pi pi-search" />
        <InputText v-model="q" placeholder="Действие, объект, подробности" fluid aria-label="Поиск по журналу" />
      </IconField>
    </div>

    <div class="overflow-hidden rounded-lg border border-line" data-testid="audit-table">
      <div class="grid grid-cols-[90px_220px_1fr_1.2fr] gap-4 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
        <span>Время</span><span>Пользователь</span><span>Действие</span><span>Объект</span>
      </div>
      <UiEmpty v-if="rows.length === 0" :text="loading ? 'Загрузка…' : 'Записей нет'" />
      <template v-for="d in days" :key="d.day">
        <div class="border-b border-line bg-canvas px-4 py-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-ink-3">{{ d.day }}</div>
        <div v-for="r in d.items" :key="r.id" class="grid grid-cols-[90px_220px_1fr_1.2fr] items-start gap-4 border-b border-line px-4 py-2.5 text-sm last:border-b-0">
          <span class="code-font text-xs text-ink-3">{{ dt.format(new Date(r.at)).slice(-5) }}</span>
          <span class="min-w-0">
            <span class="block truncate text-ink">{{ person(r.userId)?.fullName ?? r.userId }}</span>
            <span class="block truncate text-2xs text-ink-3">{{ person(r.userId)?.position }}</span>
          </span>
          <span class="flex min-w-0 items-start gap-2">
            <i :class="TYPES[r.objectType].icon" class="mt-0.5 text-xs text-brand" />
            <span class="min-w-0">
              <span class="block text-ink">{{ r.action }}</span>
              <span v-if="r.details" class="block text-xs text-ink-3">{{ r.details }}</span>
            </span>
          </span>
          <span class="min-w-0">
            <span class="block truncate text-ink-2">{{ r.objectName ?? '—' }}</span>
            <span class="code-font block text-2xs text-ink-3">{{ TYPES[r.objectType].label }}<template v-if="r.objectId"> · {{ r.objectId }}</template></span>
          </span>
        </div>
      </template>
    </div>
  </div>
</template>
