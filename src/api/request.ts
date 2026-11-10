// Контракты: заявки (обходные листы) и шаблоны согласования.

import type { CreateRequestDto, CreateRequestResult, DecideStepDto, Request, WorkflowConfig } from '@/types'
import { api } from './client'
import { endpoints } from './endpoints'

export const requestApi = {
  list: () => api.get<Request[]>(endpoints.requests.list),
  get: (id: string) => api.get<Request>(endpoints.requests.one(id)),
  /** Создание заявки: сервер подставляет строки листа из WorkflowConfig; пустой лист — изменения применяются сразу */
  create: (dto: CreateRequestDto) => api.post<CreateRequestResult>(endpoints.requests.list, dto),
  decide: (id: string, stepId: string, dto: DecideStepDto) => api.post<Request>(endpoints.requests.decide(id, stepId), dto),

  workflows: () => api.get<WorkflowConfig[]>(endpoints.requests.workflows),
  /** Создать или заменить шаблон (по id) */
  saveWorkflow: (w: WorkflowConfig) => api.put<WorkflowConfig>(endpoints.requests.workflow(w.id), w),
  removeWorkflow: (id: string) => api.delete(endpoints.requests.workflow(id)),
}
