// Точка входа: шрифты и иконки — локально из node_modules (без интернета), затем моки, затем приложение.

import '@fontsource-variable/manrope'
import 'primeicons/primeicons.css'
import './styles/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { installPrimeVue } from './plugins/primevue'
import { setAuthTokenProvider, setUnauthorizedHandler } from './api'
import { useAuthStore } from './stores/auth'

async function bootstrap(): Promise<void> {
  // VITE_USE_MOCKS подставляется при сборке: при false код моков не попадёт в бандл
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMocks } = await import('./mocks/browser')
    await startMocks()
  }

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  const auth = useAuthStore(pinia)
  setAuthTokenProvider(() => auth.token)
  setUnauthorizedHandler(() => {
    auth.clear()
    if (router.currentRoute.value.name !== 'login') {
      void router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    }
  })

  app.use(router)
  installPrimeVue(app)
  app.mount('#app')
}

void bootstrap()
