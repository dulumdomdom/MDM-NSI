<script setup lang="ts">
// Навигация на фирменном тёмно-синем (#004680). Активный пункт — основной синий (#007dba).
// Пункты уже отфильтрованы по правам в useAuth().menuGroups.
import { useAuth } from '@/composables/useAuth'
import { useUiStore } from '@/stores/ui'

const { menuGroups, user, initials, roleNames } = useAuth()
const ui = useUiStore()
</script>

<template>
  <aside class="flex shrink-0 flex-col py-2 text-white transition-[width] duration-150" :class="ui.sidebarCollapsed ? 'w-14' : 'w-60'">
    <!-- Знак продукта -->
    <div class="flex h-12 items-center gap-2.5 px-4">
      <div class="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white">
        <span class="text-[13px] font-extrabold leading-none text-brand-dark">М</span>
      </div>
      <span v-if="!ui.sidebarCollapsed" class="text-[15px] font-extrabold tracking-tight">MDM&nbsp;НСИ</span>
    </div>

    <nav class="flex flex-1 flex-col gap-5 overflow-y-auto px-2 pt-4" aria-label="Главное меню">
      <div v-for="g in menuGroups" :key="g.id" class="flex flex-col gap-0.5">
        <div v-if="g.title && !ui.sidebarCollapsed" class="px-3 pb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-brand-light/60">
          {{ g.title }}
        </div>
        <router-link
          v-for="item in g.items"
          :key="item.to"
          v-slot="{ href, navigate, isActive, isExactActive }"
          :to="item.to"
          custom
        >
          <a
            v-tooltip.right="ui.sidebarCollapsed ? item.label : undefined"
            :href="href"
            class="flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors"
            :class="
              (item.to === '/' ? isExactActive : isActive)
                ? 'bg-brand font-semibold text-white'
                : 'text-white/75 hover:bg-white/10 hover:text-white'
            "
            :data-testid="`nav-${item.to}`"
            @click="navigate"
          >
            <i :class="item.icon" class="w-4 text-center text-[13px]" />
            <span v-if="!ui.sidebarCollapsed" class="truncate">{{ item.label }}</span>
          </a>
        </router-link>
      </div>
    </nav>

    <div class="flex flex-col gap-1 px-2">
      <div v-if="!ui.sidebarCollapsed" class="flex items-center gap-2.5 rounded-md bg-white/[0.06] px-3 py-2.5">
        <div class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-light text-2xs font-bold text-brand-dark">{{ initials }}</div>
        <div class="min-w-0 leading-tight">
          <div class="truncate text-sm font-semibold">{{ user?.fullName }}</div>
          <div class="truncate text-2xs text-brand-light/70">{{ roleNames }}</div>
        </div>
      </div>
      <button
        type="button"
        class="flex h-8 items-center gap-3 rounded-md px-3 text-sm text-white/60 hover:bg-white/10 hover:text-white"
        :aria-label="ui.sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'"
        @click="ui.toggleSidebar"
      >
        <i :class="ui.sidebarCollapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'" class="w-4 text-center text-[12px]" />
        <span v-if="!ui.sidebarCollapsed">Свернуть</span>
      </button>
    </div>
  </aside>
</template>
