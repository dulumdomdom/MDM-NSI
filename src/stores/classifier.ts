// Классификаторы: реестр, текущий классификатор страницы, его сессия ввода шифра, CRUD конфигурации.
// Ввод шифра — в createClassifierSession (общий для страницы и диалога присвоения элементу).

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { classifierApi, errorMessage, requestApi } from '@/api'
import type { DuplicateCheckResult } from '@/api/classifier'
import { newClassifier } from '@/lib/classifier'
import { uniqueId } from '@/lib/ids'
import { createClassifierSession } from '@/composables/useClassifierSession'
import type { Classifier, ClassifierSummary, Request } from '@/types'
import { useUiStore } from './ui'

export type { SectionGroup } from '@/composables/useClassifierSession'

export type SubmitResult =
  | { ok: true; request: Request }
  | { ok: false; reason: 'invalid' | 'error' }
  | { ok: false; reason: 'duplicate'; duplicate: DuplicateCheckResult }

/** Текст о найденном дубликате — один для всех мест, где проверяется шифр */
export function duplicateMessage(d: DuplicateCheckResult): string {
  if (d.source === 'request') return `Такой шифр уже на согласовании (заявка ${d.requestId ?? ''})`
  if (d.source === 'element') return `Шифр уже присвоен элементу «${d.element?.display ?? ''}»`
  return `Такой шифр уже есть: ${d.entry?.shortName || d.entry?.decoded || ''}`
}

export const useClassifierStore = defineStore('classifier', () => {
  const ui = useUiStore()
  const session = createClassifierSession()

  const summaries = ref<ClassifierSummary[]>([])
  const loading = ref(false)

  async function loadList(): Promise<void> {
    summaries.value = await classifierApi.list()
  }

  async function load(id: string): Promise<void> {
    loading.value = true
    // Сначала убираем прежний конфиг: иначе UI успеет отрисоваться по старому
    // и ввод пользователя будет сброшен, когда придёт новый
    session.setClassifier(null)
    try {
      session.setClassifier(await classifierApi.get(id))
    } catch (e) {
      ui.notify('error', 'Не удалось загрузить классификатор', errorMessage(e))
    } finally {
      loading.value = false
    }
  }

  /** «Записать»: дубликат-чек по всему реестру шифров → заявка (обходной лист) */
  async function submit(): Promise<SubmitResult> {
    const c = session.classifier.value
    const r = session.parseResult.value
    if (!c || !r || !session.canSubmit.value) return { ok: false, reason: 'invalid' }
    session.saving.value = true
    try {
      const dup = await classifierApi.duplicateCheck(c.id, session.catalogId.value, r.code)
      if (dup.duplicate) return { ok: false, reason: 'duplicate', duplicate: dup }
      const { request } = await requestApi.create({
        title: `Новый шифр: ${session.shortName.value || r.code}`,
        targetType: 'classifier-entry',
        targetId: c.id,
        payload: { catalogId: session.catalogId.value, code: r.code, decoded: session.decodedString.value, shortName: session.shortName.value },
      })
      // Для записей классификатора всегда есть обходной лист (общий шаблон '*')
      return request ? { ok: true, request } : { ok: false, reason: 'error' }
    } catch (e) {
      ui.notify('error', 'Не удалось записать', errorMessage(e))
      return { ok: false, reason: 'error' }
    } finally {
      session.saving.value = false
    }
  }

  /* --------------------------- CRUD конфигурации --------------------------- */

  async function create(name: string): Promise<Classifier | null> {
    try {
      const c = await classifierApi.create(newClassifier(uniqueId('cls', name, summaries.value.map((s) => s.id)), name))
      ui.notify('success', 'Классификатор создан', 'Добавьте фасеты и структуру шифра')
      return c
    } catch (e) {
      ui.notify('error', 'Классификатор не создан', errorMessage(e))
      return null
    }
  }

  async function saveConfig(c: Classifier): Promise<boolean> {
    try {
      session.setClassifier(await classifierApi.save(c), session.catalogId.value)
      ui.notify('success', 'Конфигурация сохранена')
      return true
    } catch (e) {
      ui.notify('error', 'Конфигурация не сохранена', errorMessage(e))
      return false
    }
  }

  async function remove(id: string): Promise<boolean> {
    try {
      await classifierApi.remove(id)
      summaries.value = summaries.value.filter((s) => s.id !== id)
      ui.notify('success', 'Классификатор удалён')
      return true
    } catch (e) {
      ui.notify('error', 'Не удалось удалить', errorMessage(e))
      return false
    }
  }

  return { ...session, summaries, loading, loadList, load, submit, create, saveConfig, remove }
})
