// Контракты: интеграции с внешними системами (АСУ, 1С, Imbase).

import type { ExchangeRecord, ExchangeStatus, ExternalSystem, FlowRunResult, IntegrationFlow } from '@/types'
import { api } from './client'
import { endpoints } from './endpoints'

export interface JournalQuery {
  systemId?: string
  status?: ExchangeStatus
  elementId?: string
}

export interface PingResult {
  ok: boolean
  ms: number
  message: string
}

export const integrationApi = {
  systems: () => api.get<ExternalSystem[]>(endpoints.integrations.systems),
  saveSystem: (s: ExternalSystem) => api.put<ExternalSystem>(endpoints.integrations.system(s.id), s),
  ping: (id: string) => api.post<PingResult>(endpoints.integrations.ping(id)),
  flows: () => api.get<IntegrationFlow[]>(endpoints.integrations.flows),
  saveFlow: (f: IntegrationFlow) => api.put<IntegrationFlow>(endpoints.integrations.flow(f.id), f),
  run: (flowId: string, elementId?: string) => api.post<FlowRunResult>(endpoints.integrations.run(flowId), elementId ? { elementId } : {}),
  journal: (q: JournalQuery = {}) => api.get<ExchangeRecord[]>(endpoints.integrations.journal, { params: q }),
}
