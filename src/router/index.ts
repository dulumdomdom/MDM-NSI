// Маршруты: все view — lazy. Права маршрута — в meta.permission (проверяет guard).

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import type { PermissionAction, ResourceType } from '@/types'
import { installGuards } from './guards'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    /** Доступно без входа */
    public?: boolean
    /** Требуемое право; resourceId берётся из params.id или '*' */
    permission?: { resource: ResourceType; action: PermissionAction }
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true, title: 'Вход' },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppShell.vue'),
    children: [
      { path: '', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { title: 'Главная' } },
      {
        path: 'catalogs',
        name: 'catalogs',
        component: () => import('@/views/CatalogsView.vue'),
        meta: { title: 'Справочники', permission: { resource: 'catalog', action: 'read' } },
      },
      {
        path: 'catalogs/:id',
        name: 'catalog',
        component: () => import('@/views/CatalogDetailView.vue'),
        props: true,
        meta: { title: 'Справочник', permission: { resource: 'catalog', action: 'read' } },
      },
      {
        path: 'classifiers',
        name: 'classifiers',
        component: () => import('@/views/ClassifiersView.vue'),
        meta: { title: 'Классификаторы', permission: { resource: 'classifier', action: 'read' } },
      },
      {
        path: 'classifiers/:id',
        name: 'classifier',
        component: () => import('@/views/ClassifierDetailView.vue'),
        props: true,
        meta: { title: 'Классификатор', permission: { resource: 'classifier', action: 'read' } },
      },
      {
        path: 'intake',
        name: 'intake',
        component: () => import('@/views/IntakeView.vue'),
        meta: { title: 'Пополнение', permission: { resource: 'request', action: 'create' } },
      },
      {
        path: 'requests',
        name: 'requests',
        component: () => import('@/views/RequestsView.vue'),
        meta: { title: 'Заявки', permission: { resource: 'request', action: 'read' } },
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/AdminView.vue'),
        meta: { title: 'Администрирование', permission: { resource: 'admin', action: 'read' } },
      },
      {
        path: 'integrations',
        name: 'integrations',
        component: () => import('@/views/IntegrationsView.vue'),
        meta: { title: 'Интеграции', permission: { resource: 'admin', action: 'read' } },
      },
      {
        path: 'audit',
        name: 'audit',
        component: () => import('@/views/AuditView.vue'),
        meta: { title: 'Журнал действий', permission: { resource: 'audit', action: 'read' } },
      },
      { path: 'profile', name: 'profile', component: () => import('@/views/ProfileView.vue'), meta: { title: 'Профиль' } },
      { path: 'forbidden', name: 'forbidden', component: () => import('@/views/ForbiddenView.vue'), meta: { title: 'Нет доступа' } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { public: true } },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

installGuards(router)
