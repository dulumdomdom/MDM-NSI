<script setup lang="ts">
// Реестр справочников (только доступные пользователю — фильтр в слое данных). Создание — методолог/администратор.
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import UiEmpty from '@/components/ui/UiEmpty.vue'
import UiPageHeader from '@/components/ui/UiPageHeader.vue'
import UiPromptDialog from '@/components/ui/UiPromptDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { useCatalogStore } from '@/stores/catalog'

const store = useCatalogStore()
const auth = useAuthStore()
const router = useRouter()

const list = computed(() => store.summaries.filter((c) => auth.can('catalog', c.id, 'read')))
const canCreate = computed(() => auth.canGlobally('catalog', 'configure'))
const createVisible = ref(false)

onMounted(() => void store.loadList())

async function create(name: string): Promise<void> {
  const c = await store.createCatalog(name)
  if (c) await router.push({ path: `/catalogs/${c.id}`, query: { tab: 'structure' } })
}
</script>

<template>
  <div>
    <UiPageHeader title="Справочники" subtitle="Конфигурируемые справочники с произвольными атрибутами">
      <template #actions>
        <Button v-if="canCreate" label="Создать справочник" icon="pi pi-plus" data-testid="catalog-create" @click="createVisible = true" />
      </template>
    </UiPageHeader>

    <div class="overflow-hidden rounded-lg border border-line">
      <div class="grid grid-cols-[1fr_130px_100px_120px_110px_24px] gap-4 border-b border-line bg-brand-soft px-4 py-2 text-2xs font-bold uppercase tracking-[0.06em] text-brand-dark">
        <span>Наименование</span><span>Тип</span><span class="text-right">Атрибутов</span><span class="text-right">Классификаторов</span><span class="text-right">Элементов</span><span />
      </div>
      <UiEmpty v-if="list.length === 0" text="Нет доступных справочников" />
      <router-link
        v-for="c in list"
        :key="c.id"
        :to="`/catalogs/${c.id}`"
        class="grid grid-cols-[1fr_130px_100px_120px_110px_24px] items-center gap-4 border-b border-line px-4 py-3.5 last:border-b-0 hover:bg-brand-soft/50"
        :data-testid="`catalog-${c.id}`"
      >
        <span class="min-w-0">
          <span class="block truncate text-sm font-semibold text-ink">{{ c.name }}</span>
          <span class="block truncate text-xs text-ink-3">{{ c.description }}</span>
        </span>
        <span class="text-sm text-ink-2">{{ c.hierarchical ? 'Иерархический' : 'Плоский' }}</span>
        <span class="text-right text-sm text-ink">{{ c.attributeCount }}</span>
        <span class="text-right text-sm text-ink">{{ c.classifierCount || '—' }}</span>
        <span class="text-right text-sm font-semibold text-brand-dark">{{ c.elementCount.toLocaleString('ru-RU') }}</span>
        <i class="pi pi-chevron-right text-[10px] text-ink-3" />
      </router-link>
    </div>

    <UiPromptDialog
      v-model:visible="createVisible"
      title="Новый справочник"
      placeholder="Напр.: Оборудование"
      hint="Атрибуты, состояния и привязку классификаторов настроите после создания"
      @submit="create"
    />
  </div>
</template>
