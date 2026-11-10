<script setup lang="ts">
// Шапка листа: хлебные крошки и меню пользователя.
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Menu from 'primevue/menu'
import { useAuth } from '@/composables/useAuth'
import NotificationBell from './NotificationBell.vue'

const route = useRoute()
const router = useRouter()
const { user, initials, logout } = useAuth()

/** Крошки: раздел (первый сегмент пути) → текущая страница */
const crumbs = computed(() => {
  const sectionPath = `/${route.path.split('/')[1] ?? ''}`
  const section = router.resolve(sectionPath)
  const out: { label: string; to?: string }[] = []
  if (sectionPath !== '/' && section.name && section.name !== route.name) {
    out.push({ label: String(section.meta.title ?? ''), to: sectionPath })
  }
  out.push({ label: String(route.meta.title ?? '') })
  return out
})

const menu = ref<InstanceType<typeof Menu> | null>(null)
const items = [
  { label: 'Профиль', icon: 'pi pi-user', command: () => void router.push({ name: 'profile' }) },
  { separator: true },
  { label: 'Выйти', icon: 'pi pi-sign-out', command: () => void logout().then(() => router.push({ name: 'login' })) },
]
</script>

<template>
  <header class="flex h-12 shrink-0 items-center justify-between border-b border-line px-5">
    <nav class="flex items-center gap-1.5 text-sm" aria-label="Хлебные крошки">
      <template v-for="(c, i) in crumbs" :key="i">
        <span v-if="i > 0" class="text-line-strong">/</span>
        <router-link v-if="c.to" :to="c.to" class="text-ink-3 hover:text-ink">{{ c.label }}</router-link>
        <span v-else class="font-semibold text-brand-dark">{{ c.label }}</span>
      </template>
    </nav>

    <div class="flex items-center gap-2">
    <NotificationBell />
    <button
      type="button"
      class="flex items-center gap-2 rounded-md py-1 pl-2 pr-1 text-sm text-ink-2 hover:bg-canvas"
      aria-haspopup="true"
      aria-label="Меню пользователя"
      @click="(e) => menu?.toggle(e)"
    >
      <span class="hidden sm:inline" data-testid="current-user">{{ user?.fullName }}</span>
      <span class="grid h-7 w-7 place-items-center rounded-full bg-brand text-[10px] font-bold text-white">{{ initials }}</span>
    </button>
    </div>
    <Menu ref="menu" :model="items" popup />
  </header>
</template>
