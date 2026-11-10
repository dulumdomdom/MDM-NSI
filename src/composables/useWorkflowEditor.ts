// Редактор шаблона обходного листа для объекта (справочника / классификатора) и типа заявки.
// Если у объекта нет своего шаблона — действует общий ('*'); «Настроить свой» создаёт копию.

import { deepClone } from '@/lib/clone'
import { computed, ref, watch } from 'vue'
import { useRequestStore } from '@/stores/request'
import type { RequestTargetType, WorkflowConfig } from '@/types'

type Step = WorkflowConfig['steps'][number]

export function useWorkflowEditor(targetType: RequestTargetType, targetId: () => string) {
  const store = useRequestStore()

  const own = computed(() => store.workflows.find((w) => w.targetType === targetType && w.targetId === targetId()))
  const general = computed(() => store.workflows.find((w) => w.targetType === targetType && w.targetId === '*'))
  const draft = ref<WorkflowConfig | null>(null)

  watch(own, (w) => (draft.value = w ? deepClone(w) : null), { immediate: true })

  const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(own.value ?? null))
  const valid = computed(() => !draft.value || draft.value.steps.every((s) => s.name.trim() && s.roleId && (s.kind !== 'encode' || s.classifierId)))

  /** Начать свой шаблон (копия общего или пустой) */
  function customize(): void {
    const base = general.value
    draft.value = {
      id: `wf-${targetType}-${targetId()}`,
      targetType,
      targetId: targetId(),
      sequential: base?.sequential ?? false,
      steps: base ? deepClone(base.steps) : [],
    }
  }

  const renumber = (steps: Step[]): Step[] => steps.map((s, i) => ({ ...s, order: i + 1 }))

  function edit(fn: (w: WorkflowConfig) => WorkflowConfig): void {
    if (draft.value) draft.value = fn(draft.value)
  }

  /** Строка листа: проверка или шифрование по классификатору (для шифрования — модератор этого классификатора) */
  function addStep(kind: Step['kind'] = 'review', classifierId?: string): void {
    edit((w) => ({
      ...w,
      steps: renumber([
        ...w.steps,
        {
          id: `st-${Date.now().toString(36)}`,
          order: 0,
          kind,
          name: kind === 'encode' ? 'Шифрование' : '',
          roleId: 'role-moderator',
          attributeIds: [],
          ...(kind === 'encode' ? { optional: true, ...(classifierId ? { classifierId } : {}) } : {}),
        },
      ]),
    }))
  }

  const updateStep = (id: string, patch: Partial<Step>) => edit((w) => ({ ...w, steps: w.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))
  const removeStep = (id: string) => edit((w) => ({ ...w, steps: renumber(w.steps.filter((s) => s.id !== id)) }))

  function moveStep(id: string, delta: -1 | 1): void {
    edit((w) => {
      const list = [...w.steps]
      const i = list.findIndex((s) => s.id === id)
      const a = list[i]
      const b = list[i + delta]
      if (!a || !b) return w
      list[i] = b
      list[i + delta] = a
      return { ...w, steps: renumber(list) }
    })
  }

  const setSequential = (v: boolean) => edit((w) => ({ ...w, sequential: v }))

  async function save(): Promise<void> {
    if (draft.value && valid.value) await store.saveWorkflow(deepClone(draft.value))
  }

  /** Удалить свой шаблон — снова действует общий (или согласование не требуется) */
  async function reset(): Promise<void> {
    if (own.value) await store.removeWorkflow(own.value.id)
    else draft.value = null
  }

  return { own, general, draft, dirty, valid, customize, addStep, updateStep, removeStep, moveStep, setSequential, save, reset }
}
