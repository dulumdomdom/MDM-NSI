// Интеграции: внешние системы, потоки обмена, журнал.

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { catalogApi, errorMessage, integrationApi } from '@/api'
import type { JournalQuery } from '@/api/integration'
import type { Catalog, ExchangeRecord, ExternalSystem, IntegrationFlow } from '@/types'
import { useUiStore } from './ui'

export const useIntegrationStore = defineStore('integration', () => {
  const ui = useUiStore()

  const systems = ref<ExternalSystem[]>([])
  const flows = ref<IntegrationFlow[]>([])
  const journal = ref<ExchangeRecord[]>([])
  const loading = ref(false)
  const running = ref<string | null>(null)
  /** Схемы справочников, участвующих в обмене (для подписей полей и настройки потоков) */
  const catalogs = ref<Record<string, Catalog>>({})

  const systemName = (id: string) => systems.value.find((s) => s.id === id)?.name ?? id
  const flowsOf = (systemId: string) => flows.value.filter((f) => f.systemId === systemId)
  /** Ошибки в журнале по системе (за загруженный период) */
  const errorsOf = computed(() => (systemId: string) => journal.value.filter((r) => r.systemId === systemId && r.status === 'error').length)
  const lastExchange = computed(() => (systemId: string) => journal.value.find((r) => r.systemId === systemId)?.at)

  async function load(): Promise<void> {
    loading.value = true
    try {
      ;[systems.value, flows.value, journal.value] = await Promise.all([integrationApi.systems(), integrationApi.flows(), integrationApi.journal()])
      const ids = [...new Set(flows.value.map((f) => f.catalogId))].filter((id) => !catalogs.value[id])
      const loaded = await Promise.all(ids.map((id) => catalogApi.get(id)))
      catalogs.value = { ...catalogs.value, ...Object.fromEntries(loaded.map((c) => [c.id, c])) }
    } catch (e) {
      ui.notify('error', 'Не удалось загрузить интеграции', errorMessage(e))
    } finally {
      loading.value = false
    }
  }

  /** Системы и потоки без журнала — для карточки элемента (журнал целиком видит только администратор) */
  async function loadMeta(): Promise<void> {
    if (systems.value.length && flows.value.length) return
    ;[systems.value, flows.value] = await Promise.all([integrationApi.systems(), integrationApi.flows()])
  }

  /** Выборка журнала по фильтру (общий журнал store не меняется — по нему считаются карточки систем) */
  async function queryJournal(q: JournalQuery): Promise<ExchangeRecord[]> {
    try {
      return await integrationApi.journal(q)
    } catch (e) {
      ui.notify('error', 'Журнал недоступен', errorMessage(e))
      return []
    }
  }

  async function saveSystem(s: ExternalSystem): Promise<void> {
    try {
      const saved = await integrationApi.saveSystem(s)
      systems.value = systems.value.map((x) => (x.id === saved.id ? saved : x))
      ui.notify('success', saved.enabled ? `Обмен с ${saved.name} включён` : `Обмен с ${saved.name} отключён`)
    } catch (e) {
      ui.notify('error', 'Не сохранено', errorMessage(e))
    }
  }

  async function ping(id: string): Promise<void> {
    try {
      const r = await integrationApi.ping(id)
      ui.notify(r.ok ? 'success' : 'warn', r.ok ? `Связь есть · ${r.ms} мс` : 'Нет связи', r.message)
    } catch (e) {
      ui.notify('error', 'Нет связи', errorMessage(e))
    }
  }

  async function saveFlow(f: IntegrationFlow): Promise<boolean> {
    try {
      const saved = await integrationApi.saveFlow(f)
      const exists = flows.value.some((x) => x.id === saved.id)
      flows.value = exists ? flows.value.map((x) => (x.id === saved.id ? saved : x)) : [...flows.value, saved]
      ui.notify('success', 'Поток сохранён')
      return true
    } catch (e) {
      ui.notify('error', 'Поток не сохранён', errorMessage(e))
      return false
    }
  }

  /** Запуск вручную; elementId — выгрузить один элемент. Возвращает журнальные записи запуска */
  async function run(flowId: string, elementId?: string): Promise<ExchangeRecord[]> {
    running.value = flowId
    try {
      const res = await integrationApi.run(flowId, elementId)
      flows.value = flows.value.map((f) => (f.id === res.flow.id ? res.flow : f))
      journal.value = [...res.records, ...journal.value.filter((r) => !res.records.some((x) => x.id === r.id))]
      const failed = res.records.some((r) => r.status === 'error')
      ui.notify(failed ? 'warn' : 'success', `${systemName(res.flow.systemId)}: ${res.flow.name}`, res.summary)
      return res.records
    } catch (e) {
      ui.notify('error', 'Обмен не выполнен', errorMessage(e))
      return []
    } finally {
      running.value = null
    }
  }

  return { systems, flows, journal, catalogs, loading, running, systemName, flowsOf, errorsOf, lastExchange, load, loadMeta, queryJournal, saveSystem, ping, saveFlow, run }
})
