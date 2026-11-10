<script setup lang="ts">
// Главная: сводные показатели, задачи пользователя, последние заявки, быстрый доступ к классификаторам.
import { computed, onMounted } from 'vue'
import Button from 'primevue/button'
import UiCard from '@/components/ui/UiCard.vue'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import { useAuth } from '@/composables/useAuth'
import { useCatalogStore } from '@/stores/catalog'
import { useClassifierStore } from '@/stores/classifier'
import { progress, useRequestStore } from '@/stores/request'
import { useAuthStore } from '@/stores/auth'
import type { RequestStatus } from '@/types'

const { canAny } = useAuth()
const catalogs = useCatalogStore()
const classifiers = useClassifierStore()
const requests = useRequestStore()
const auth = useAuthStore()

/** Названия строк обходного листа, которые ждут подписи пользователя */
const mySteps = (r: (typeof requests.items)[number]) => r.steps.filter((s) => auth.canDecide(r, s)).map((s) => s.name).join(', ')

onMounted(() => {
  if (canAny('catalog', 'read')) void catalogs.loadList()
  if (canAny('classifier', 'read')) void classifiers.loadList()
  if (canAny('request', 'read')) void requests.load()
})

const today = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
const dt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const fmt = (n: number) => n.toLocaleString('ru-RU')

const kpi = computed(() => [
  { label: 'Справочников', value: fmt(catalogs.summaries.length) },
  { label: 'Элементов', value: fmt(catalogs.summaries.reduce((s, c) => s + c.elementCount, 0)) },
  { label: 'Классификаторов', value: fmt(classifiers.summaries.length) },
  { label: 'На согласовании', value: fmt(requests.items.filter((r) => r.status === 'in_review').length) },
  { label: 'Просрочено', value: fmt(requests.overdue.length), alert: requests.overdue.length > 0 },
])

const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' })

const STATUS: Record<RequestStatus, { label: string; dot: string }> = {
  in_review: { label: 'На согласовании', dot: 'bg-brand' },
  approved: { label: 'Утверждена', dot: 'bg-emerald-500' },
  rejected: { label: 'Отклонена', dot: 'bg-[var(--danger)]' },
}
const recent = computed(() => requests.items.slice(0, 6))
</script>

<template>
  <div>
    <UiPageHeader title="Сводка" :subtitle="today">
      <template #actions>
        <router-link v-if="canAny('request', 'create')" to="/intake">
          <Button label="Пополнить справочник" icon="pi pi-plus" />
        </router-link>
      </template>
    </UiPageHeader>

    <!-- Замещение: чьи строки заявок сейчас у пользователя -->
    <div
      v-for="d in auth.delegations"
      :key="d.userId"
      class="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
      data-testid="delegation-banner"
    >
      <i class="pi pi-user-edit text-[var(--accent)]" />
      <span class="text-ink">
        Вы замещаете <b>{{ d.fullName }}</b> до {{ dayFmt.format(new Date(d.until)) }} — его строки заявок и уведомления приходят вам.
      </span>
    </div>

    <!-- Показатели: одна полоса, ячейки разделены линиями -->
    <div class="grid grid-cols-2 overflow-hidden rounded-lg border border-line lg:grid-cols-5">
      <component
        :is="k.alert ? 'router-link' : 'div'"
        v-for="(k, i) in kpi"
        :key="k.label"
        :to="k.alert ? '/requests' : undefined"
        class="border-line px-5 py-4"
        :class="[i > 0 ? 'lg:border-l' : '', i % 2 === 1 ? 'border-l' : '', i >= 2 ? 'border-t lg:border-t-0' : '', k.alert ? 'bg-red-50 hover:bg-red-100' : '']"
      >
        <div class="text-xs" :class="k.alert ? 'font-semibold text-red-700' : 'text-ink-3'">{{ k.label }}</div>
        <div class="mt-1 text-[28px] font-extrabold leading-8 tracking-[-0.02em]" :class="k.alert ? 'text-red-700' : 'text-brand-dark'">{{ k.value }}</div>
      </component>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
      <UiCard title="Ждут моего решения" flush>
        <template #actions>
          <router-link to="/requests" class="text-xs font-medium text-brand hover:underline">Все заявки</router-link>
        </template>
        <UiEmpty v-if="requests.awaitingMe.length === 0" text="Задач нет" />
        <router-link
          v-for="r in requests.awaitingMe.slice(0, 5)"
          :key="r.id"
          :to="{ path: '/requests', query: { id: r.id } }"
          class="grid grid-cols-[1fr_auto] gap-x-4 border-b border-line px-4 py-3 last:border-b-0 hover:bg-canvas/60"
        >
          <span class="truncate text-sm font-medium text-ink">{{ r.title }}</span>
          <span class="text-xs text-ink-3">{{ dt.format(new Date(r.createdAt)) }}</span>
          <span class="code-font truncate text-xs text-ink-2">{{ r.payload['code'] }}</span>
          <span class="text-xs text-ink-3">{{ mySteps(r) }} · {{ progress(r).done }}/{{ progress(r).total }}</span>
        </router-link>
      </UiCard>

      <UiCard title="Мои заявки" flush>
        <template #actions>
          <router-link v-if="canAny('request', 'create')" to="/intake" class="text-xs font-medium text-brand hover:underline">Новая</router-link>
        </template>
        <UiEmpty v-if="requests.mine.length === 0" text="Вы ещё не создавали заявок" />
        <router-link
          v-for="r in requests.mine.slice(0, 5)"
          :key="r.id"
          :to="{ path: '/requests', query: { id: r.id } }"
          class="flex items-center justify-between gap-4 border-b border-line px-4 py-3 last:border-b-0 hover:bg-canvas/60"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-medium text-ink">{{ r.payload.name ?? r.title }}</span>
            <span class="flex items-center gap-1.5 text-xs text-ink-3">
              <i class="h-1.5 w-1.5 rounded-full" :class="STATUS[r.status].dot" />{{ STATUS[r.status].label }} · {{ progress(r).done }}/{{ progress(r).total }}
            </span>
          </span>
          <i class="pi pi-chevron-right text-[10px] text-ink-3" />
        </router-link>
      </UiCard>
    </div>

    <UiCard title="Последние заявки" flush class="mt-5">
      <UiEmpty v-if="recent.length === 0" text="Заявок пока нет" />
      <table v-else class="w-full text-sm">
        <tbody>
          <tr v-for="r in recent" :key="r.id" class="border-b border-line last:border-b-0">
            <td class="w-40 whitespace-nowrap px-4 py-2.5">
              <span class="flex items-center gap-2 text-xs text-ink-2">
                <i class="h-1.5 w-1.5 rounded-full" :class="STATUS[r.status].dot" />{{ STATUS[r.status].label }}
              </span>
            </td>
            <td class="px-4 py-2.5 font-medium text-ink">{{ r.title }}</td>
            <td class="code-font hidden px-4 py-2.5 text-xs text-ink-2 md:table-cell">{{ r.payload['code'] }}</td>
            <td class="whitespace-nowrap px-4 py-2.5 text-right text-xs text-ink-3">{{ dt.format(new Date(r.createdAt)) }}</td>
          </tr>
        </tbody>
      </table>
    </UiCard>
  </div>
</template>
