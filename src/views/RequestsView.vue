<script setup lang="ts">
// Заявки: обходные листы. Фильтры «Мне на подпись / Мои / Все»; карточка — справа, с подписанием строк.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import RequestSheet from '@/components/common/RequestSheet.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { isOverdue } from '@/lib/rbac'
import { progress, TARGET_LABELS, useRequestStore } from '@/stores/request'
import type { Request, RequestStatus } from '@/types'

const store = useRequestStore()
const route = useRoute()
const router = useRouter()
onMounted(() => void store.load())

type Filter = 'mine-to-sign' | 'overdue' | 'mine' | 'all'
const filter = ref<Filter>('all')
const filters = computed(() => [
  { value: 'mine-to-sign', label: `Мне на подпись · ${store.awaitingMe.length}` },
  { value: 'overdue', label: `Просрочено · ${store.overdue.length}` },
  { value: 'mine', label: `Мои · ${store.mine.length}` },
  { value: 'all', label: `Все · ${store.items.length}` },
])
const query = ref('')
const byFilter = computed(() =>
  filter.value === 'mine-to-sign' ? store.awaitingMe : filter.value === 'overdue' ? store.overdue : filter.value === 'mine' ? store.mine : store.items,
)
/** Поиск по названию, номеру, автору и шифру */
const list = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return byFilter.value
  return byFilter.value.filter((r) => `${r.title} ${r.id} ${store.personName(r.createdBy)} ${r.payload.code ?? ''}`.toLowerCase().includes(q))
})
const late = (r: Request) => r.status === 'in_review' && r.steps.some((s) => isOverdue(s))

/** Открытая заявка — в query (?id=), чтобы на неё можно было дать ссылку */
const openId = computed({
  get: () => (typeof route.query['id'] === 'string' ? route.query['id'] : null),
  set: (v: string | null) => void router.replace({ query: { ...route.query, id: v ?? undefined } }),
})
const opened = computed<Request | null>(() => store.items.find((r) => r.id === openId.value) ?? null)

const STATUS: Record<RequestStatus, { label: string; dot: string }> = {
  in_review: { label: 'На согласовании', dot: 'bg-brand' },
  approved: { label: 'Утверждена', dot: 'bg-emerald-500' },
  rejected: { label: 'Отклонена', dot: 'bg-red-500' },
}
const dt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div>
    <UiPageHeader title="Заявки" subtitle="Обходные листы: заявка утверждена, когда её подписали все ответственные" />

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <SelectButton v-model="filter" :options="filters" option-label="label" option-value="value" :allow-empty="false" />
      <IconField>
        <InputIcon class="pi pi-search" />
        <InputText v-model="query" placeholder="Название, номер, автор, шифр" class="w-72" aria-label="Поиск заявок" data-testid="requests-search" />
      </IconField>
    </div>

    <div class="overflow-hidden rounded-lg border border-line" data-testid="requests-table">
      <div class="grid grid-cols-[150px_1fr_150px_170px_190px] gap-4 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
        <span>Статус</span><span>Заявка</span><span>Тип</span><span>Обходной лист</span><span>Автор</span>
      </div>
      <UiEmpty v-if="list.length === 0" :text="filter === 'mine-to-sign' ? 'Нет строк, ожидающих вашей подписи' : 'Заявок нет'" />
      <button
        v-for="r in list"
        :key="r.id"
        type="button"
        class="grid w-full grid-cols-[150px_1fr_150px_170px_190px] items-center gap-4 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-brand-soft/50"
        :class="openId === r.id ? 'bg-brand-soft/70' : ''"
        :data-testid="`request-${r.id}`"
        @click="openId = r.id"
      >
        <span class="flex flex-col gap-1">
          <span class="flex items-center gap-2 text-xs text-ink-2"><i class="h-1.5 w-1.5 rounded-full" :class="STATUS[r.status].dot" />{{ STATUS[r.status].label }}</span>
          <span v-if="late(r)" class="w-fit rounded-sm bg-red-50 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.04em] text-red-700">просрочено</span>
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-ink">{{ r.title }}</span>
          <span class="code-font block truncate text-xs text-ink-3">{{ r.payload['code'] ?? '' }}</span>
        </span>
        <span class="text-sm text-ink-2">{{ TARGET_LABELS[r.targetType] }}</span>
        <span class="flex items-center gap-2">
          <span class="flex flex-1 gap-0.5">
            <span
              v-for="s in r.steps"
              :key="s.id"
              class="h-1.5 flex-1 rounded-full"
              :class="s.status === 'approved' ? 'bg-emerald-500' : s.status === 'rejected' ? 'bg-red-500' : 'bg-line'"
            />
          </span>
          <span class="text-xs text-ink-3">{{ progress(r).done }}/{{ progress(r).total }}</span>
        </span>
        <span class="min-w-0">
          <span class="block truncate text-sm text-ink">{{ store.personName(r.createdBy) }}</span>
          <span class="block text-xs text-ink-3">{{ dt.format(new Date(r.createdAt)) }}</span>
        </span>
      </button>
    </div>

    <Drawer :visible="!!opened" position="right" class="!w-full md:!w-[40rem]" header="Заявка" @update:visible="(v: boolean) => !v && (openId = null)">
      <RequestSheet v-if="opened" :request="opened" />
    </Drawer>
  </div>
</template>
