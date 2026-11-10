import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Сборка полностью автономна: никаких CDN, шрифты и иконки — из node_modules.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Все компоненты сканируются при старте: зависимости (компоненты PrimeVue) оптимизируются сразу,
  // и dev-сервер не перезагружает страницу посреди работы, встретив новый импорт
  optimizeDeps: {
    entries: ['index.html', 'src/**/*.vue'],
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Тяжёлые вендоры — в отдельные чанки, чтобы кешировались независимо от кода приложения
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          primevue: ['primevue/config', '@primeuix/themes'],
        },
      },
    },
  },
})
