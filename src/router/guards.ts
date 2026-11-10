// Guards: аутентификация (восстановление сессии по токену) и права маршрута.

import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

export function installGuards(router: Router): void {
  router.beforeEach(async (to) => {
    const auth = useAuthStore()
    await auth.restore()

    if (to.meta.public) {
      // Уже вошёл — на логин не пускаем
      return to.name === 'login' && auth.isAuthenticated ? { name: 'home' } : true
    }
    if (!auth.isAuthenticated) return { name: 'login', query: { redirect: to.fullPath } }

    const perm = to.meta.permission
    if (perm) {
      const id = typeof to.params['id'] === 'string' ? to.params['id'] : '*'
      const allowed =
        id === '*'
          ? auth.canAny(perm.resource, perm.action)
          : auth.can(perm.resource, id, perm.action)
      if (!allowed) return { name: 'forbidden' }
    }
    return true
  })

  router.afterEach((to) => {
    document.title = to.meta.title ? `${to.meta.title} · MDM НСИ` : 'MDM НСИ'
  })
}
