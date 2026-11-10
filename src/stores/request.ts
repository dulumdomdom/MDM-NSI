// Заявки-обходные листы и шаблоны согласования. Право решать строку — auth.canDecide (роль строки в области объекта).

import { isOverdue } from '@/lib/rbac'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { adminApi, errorMessage, requestApi } from '@/api'
import type { UserBrief } from '@/api/auth'
import type { CreateRequestDto, CreateRequestResult, DecideStepDto, Request, RequestStep, RequestTargetType, Role, WorkflowConfig } from '@/types'
import { useAuthStore } from './auth'
import { useUiStore } from './ui'

/** Строки, которые сейчас может подписать пользователь */
export const decidableSteps = (r: Request, canDecide: (r: Request, s: RequestStep) => boolean): RequestStep[] =>
  r.steps.filter((s) => canDecide(r, s))

/** Прогресс обходного листа: подписано / всего */
export const progress = (r: Request) => ({ done: r.steps.filter((s) => s.status === 'approved').length, total: r.steps.length })

export const TARGET_LABELS: Record<RequestTargetType, string> = {
  'catalog-element': 'Пополнение',
  'element-edit': 'Корректировка',
  'element-code': 'Шифр элемента',
  'classifier-entry': 'Запись классификатора',
}

export const useRequestStore = defineStore('request', () => {
  const auth = useAuthStore()
  const ui = useUiStore()

  const items = ref<Request[]>([])
  const workflows = ref<WorkflowConfig[]>([])
  const people = ref<UserBrief[]>([])
  const roles = ref<Role[]>([])
  const loading = ref(false)

  /** Заявки, где у пользователя есть строка к подписи */
  const awaitingMe = computed(() => items.value.filter((r) => decidableSteps(r, auth.canDecide).length > 0))
  const mine = computed(() => items.value.filter((r) => r.createdBy === auth.user?.id))
  /** Заявки в работе, где есть строка с истёкшим сроком */
  const overdue = computed(() => items.value.filter((r) => r.status === 'in_review' && r.steps.some((s) => isOverdue(s))))

  const personName = (id: string | undefined): string => (id ? (people.value.find((p) => p.id === id)?.fullName ?? id) : '')
  const roleName = (id: string): string => roles.value.find((r) => r.id === id)?.name ?? id

  async function load(): Promise<void> {
    loading.value = true
    try {
      ;[items.value, workflows.value, people.value, roles.value] = await Promise.all([
        requestApi.list(),
        requestApi.workflows(),
        adminApi.directory(),
        adminApi.roles(),
      ])
    } catch (e) {
      ui.notify('error', 'Не удалось загрузить заявки', errorMessage(e))
    } finally {
      loading.value = false
    }
  }

  /** Создать заявку. Пустой обходной лист — изменения применены сразу (result.applied) */
  async function create(dto: CreateRequestDto): Promise<CreateRequestResult | null> {
    try {
      const res = await requestApi.create(dto)
      if (res.request) items.value = [res.request, ...items.value]
      return res
    } catch (e) {
      ui.notify('error', 'Заявка не создана', errorMessage(e))
      return null
    }
  }

  /** Решение по строке листа. Возвращает null или текст ошибки (напр. дубликат шифра — показать в диалоге) */
  async function decide(id: string, stepId: string, dto: DecideStepDto): Promise<string | null> {
    try {
      const r = await requestApi.decide(id, stepId, dto)
      items.value = items.value.map((x) => (x.id === r.id ? r : x))
      const done = r.status === 'approved' ? 'Все строки пройдены — заявка обработана, изменения внесены в справочник.' : undefined
      const title = { approved: dto.code ? 'Шифр присвоен' : 'Согласовано', rejected: 'Заявка отклонена', skipped: 'Отмечено «не применимо»' }[dto.decision]
      ui.notify('success', title, done)
      return null
    } catch (e) {
      return errorMessage(e)
    }
  }

  const notifyError = (detail: string) => ui.notify('error', 'Решение не сохранено', detail)

  /* --------------------------- шаблоны листов --------------------------- */

  /** Шаблон, который реально применится к объекту: свой или общий '*' */
  function effectiveWorkflow(targetType: RequestTargetType, targetId: string): WorkflowConfig | undefined {
    return (
      workflows.value.find((w) => w.targetType === targetType && w.targetId === targetId) ??
      workflows.value.find((w) => w.targetType === targetType && w.targetId === '*')
    )
  }

  async function saveWorkflow(w: WorkflowConfig): Promise<boolean> {
    try {
      const saved = await requestApi.saveWorkflow(w)
      const exists = workflows.value.some((x) => x.id === saved.id)
      workflows.value = exists ? workflows.value.map((x) => (x.id === saved.id ? saved : x)) : [...workflows.value, saved]
      ui.notify('success', 'Обходной лист сохранён')
      return true
    } catch (e) {
      ui.notify('error', 'Обходной лист не сохранён', errorMessage(e))
      return false
    }
  }

  async function removeWorkflow(id: string): Promise<void> {
    try {
      await requestApi.removeWorkflow(id)
      workflows.value = workflows.value.filter((w) => w.id !== id)
      ui.notify('success', 'Согласование отключено')
    } catch (e) {
      ui.notify('error', 'Не удалось удалить шаблон', errorMessage(e))
    }
  }

  return {
    items,
    workflows,
    people,
    roles,
    loading,
    awaitingMe,
    mine,
    overdue,
    personName,
    roleName,
    load,
    create,
    decide,
    notifyError,
    effectiveWorkflow,
    saveWorkflow,
    removeWorkflow,
  }
})
