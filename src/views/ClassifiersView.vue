<script setup lang="ts">
// Реестр классификаторов. Создание — методолог/администратор.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import UiPromptDialog from '@/components/ui/UiPromptDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useClassifierStore } from '@/stores/classifier'

const store = useClassifierStore()
const auth = useAuthStore()
const router = useRouter()

const list = computed(() => store.summaries.filter((c) => auth.can('classifier', c.id, 'read')))
const canCreate = computed(() => auth.canGlobally('classifier', 'configure'))
const createVisible = ref(false)

onMounted(() => void store.loadList())

async function create(name: string): Promise<void> {
  const c = await store.create(name)
  if (c) await router.push({ path: `/classifiers/${c.id}`, query: { tab: 'settings' } })
}
</script>

<template>
  <div>
    <UiPageHeader title="Классификаторы" subtitle="Фасетные классификаторы с переменной структурой шифра">
      <template #actions>
        <Button v-if="canCreate" label="Создать классификатор" icon="pi pi-plus" data-testid="classifier-create" @click="createVisible = true" />
      </template>
    </UiPageHeader>
    <div class="overflow-hidden rounded-lg border border-line">
      <div class="grid grid-cols-[1fr_1fr_90px_90px_100px_24px] gap-4 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
        <span>Наименование</span><span>Используется в справочниках</span><span class="text-right">Каталогов</span><span class="text-right">Фасетов</span><span class="text-right">Записей</span><span />
      </div>
      <UiEmpty v-if="list.length === 0" text="Нет доступных классификаторов" />
      <router-link
        v-for="c in list"
        :key="c.id"
        :to="`/classifiers/${c.id}`"
        class="grid grid-cols-[1fr_1fr_90px_90px_100px_24px] items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-brand-soft/50"
        :data-testid="`classifier-${c.id}`"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-ink">{{ c.name }}</span>
          <span class="block truncate text-xs text-ink-3">{{ c.description }}</span>
        </span>
        <span class="truncate text-sm text-ink-2">{{ c.boundCatalogs.join(', ') || '—' }}</span>
        <span class="text-right text-sm text-ink">{{ c.catalogCount }}</span>
        <span class="text-right text-sm text-ink">{{ c.facetCount }}</span>
        <span class="text-right text-sm font-semibold text-brand-dark">{{ c.entryCount }}</span>
        <i class="pi pi-chevron-right text-[10px] text-ink-3" />
      </router-link>
    </div>
    <UiPromptDialog
      v-model:visible="createVisible"
      title="Новый классификатор"
      placeholder="Напр.: Классификатор оборудования"
      hint="Фасеты, структуру шифра и расшифровку настроите после создания"
      @submit="create"
    />
  </div>
</template>
