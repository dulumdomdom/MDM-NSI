<script setup lang="ts">
// Каркас: навигация на фирменном тёмно-синем, контент — на белом листе со своей прокруткой.
import AppSidebar from './AppSidebar.vue'
import AppTopbar from './AppTopbar.vue'
</script>

<template>
  <div class="flex h-full bg-brand-dark">
    <AppSidebar />
    <div class="my-2 mr-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-white">
      <AppTopbar />
      <main id="app-scroll" class="min-h-0 flex-1 overflow-auto">
        <div class="mx-auto w-full max-w-[1480px] px-8 py-7">
          <router-view v-slot="{ Component, route }">
            <Transition name="page" appear>
              <!-- Ключ — путь без query: смена вкладки (?tab=) не пересоздаёт страницу и не теряет черновики -->
              <component :is="Component" :key="route.path" />
            </Transition>
          </router-view>
        </div>
      </main>
    </div>
  </div>
</template>
