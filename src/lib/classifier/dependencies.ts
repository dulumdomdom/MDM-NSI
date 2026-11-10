// Контекстные зависимости фасетов: применение декларативных правил (данных) к пути структуры.
// Правило фасета N влияет только на фасеты M, идущие ПОСЛЕ N в пути (M > N).

import type { Classifier, CodeName, FacetConfig, FacetDependencyRule } from '@/types'
import { evaluateCondition, parseFloatStrict } from './conditions'

export type OverrideField = 'label' | 'options' | 'visible'

export interface ResolvedOverride {
  label?: string
  options?: CodeName[]
  visible?: boolean
  /** Какие правила сработали на этот фасет (в порядке применения) */
  ruleIds: string[]
  fields: OverrideField[]
}

/** facetId → итоговое переопределение */
export type OverrideMap = Record<string, ResolvedOverride>

/** Фасет с учётом переопределений — то, что видит UI и валидатор */
export interface EffectiveFacet {
  label: string
  options: CodeName[] | undefined
  visible: boolean
  overriddenFields: OverrideField[]
  ruleIds: string[]
}

/** Все правила классификатора плоским списком (в порядке словаря фасетов) */
export function collectRules(facets: FacetConfig[]): FacetDependencyRule[] {
  return facets.flatMap((f) => f.dependencies ?? [])
}

/** Сработало ли правило на текущем значении фасета-триггера */
export function ruleMatches(rule: FacetDependencyRule, value: string | undefined): boolean {
  if (value === undefined || value === '') return false
  if (rule.triggerCondition) return evaluateCondition(rule.triggerCondition, value)
  if (typeof rule.triggerValue === 'number') {
    const n = parseFloatStrict(value)
    return n !== null && n === rule.triggerValue
  }
  return value === rule.triggerValue
}

/**
 * Применить правила к значениям.
 * @param order — порядок фасетов в текущем пути. Фасеты, ещё не попавшие в путь,
 *                считаются «последующими» (так работает инкрементальный разбор).
 * Конфликты: правила применяются по позиции триггера в пути, затем по порядку объявления;
 * каждое поле (label/options/visible) — «последний выигрывает».
 */
export function resolveOverrides(
  rules: FacetDependencyRule[],
  values: Readonly<Record<string, string>>,
  order: readonly string[],
): OverrideMap {
  const pos = new Map(order.map((id, i) => [id, i]))
  const active = rules
    .map((rule, declIdx) => ({ rule, declIdx, triggerIdx: pos.get(rule.triggerFacetId) }))
    .filter((r): r is { rule: FacetDependencyRule; declIdx: number; triggerIdx: number } => r.triggerIdx !== undefined)
    .sort((a, b) => a.triggerIdx - b.triggerIdx || a.declIdx - b.declIdx)

  const out: OverrideMap = {}
  for (const { rule, triggerIdx } of active) {
    if (!ruleMatches(rule, values[rule.triggerFacetId])) continue
    for (const ov of rule.overrides) {
      const targetIdx = pos.get(ov.facetId)
      // Только вперёд: на себя и на предыдущие фасеты правило не действует
      if (ov.facetId === rule.triggerFacetId || (targetIdx !== undefined && targetIdx <= triggerIdx)) continue
      const acc = (out[ov.facetId] ??= { ruleIds: [], fields: [] })
      acc.ruleIds.push(rule.id)
      if (ov.label !== undefined) setField(acc, 'label', () => (acc.label = ov.label))
      if (ov.options !== undefined) setField(acc, 'options', () => (acc.options = ov.options))
      if (ov.visible !== undefined) setField(acc, 'visible', () => (acc.visible = ov.visible))
    }
  }
  return out
}

function setField(acc: ResolvedOverride, field: OverrideField, apply: () => void): void {
  apply()
  if (!acc.fields.includes(field)) acc.fields.push(field)
}

/** Наложить переопределение на конфиг фасета */
export function effectiveFacet(facet: FacetConfig, ov: ResolvedOverride | undefined): EffectiveFacet {
  return {
    label: ov?.label ?? facet.name,
    options: ov?.options ?? facet.options,
    visible: ov?.visible ?? facet.visible ?? true,
    overriddenFields: ov?.fields ?? [],
    ruleIds: ov?.ruleIds ?? [],
  }
}

export interface RuleIssue {
  ruleId: string
  message: string
}

/** Проверка конфигурации правил (для DependencyEditor и тестов моков) */
export function validateRules(classifier: Classifier): RuleIssue[] {
  const ids = new Set(classifier.facets.map((f) => f.id))
  const issues: RuleIssue[] = []
  const seen = new Set<string>()
  for (const facet of classifier.facets) {
    for (const rule of facet.dependencies ?? []) {
      if (seen.has(rule.id)) issues.push({ ruleId: rule.id, message: 'Дублируется id правила' })
      seen.add(rule.id)
      if (rule.triggerFacetId !== facet.id)
        issues.push({ ruleId: rule.id, message: `Триггер ${rule.triggerFacetId} не совпадает с фасетом-владельцем ${facet.id}` })
      if (rule.overrides.length === 0) issues.push({ ruleId: rule.id, message: 'Нет переопределений' })
      for (const ov of rule.overrides) {
        if (!ids.has(ov.facetId)) issues.push({ ruleId: rule.id, message: `Неизвестный фасет ${ov.facetId}` })
        if (ov.facetId === rule.triggerFacetId) issues.push({ ruleId: rule.id, message: 'Правило ссылается на свой триггер' })
      }
    }
  }
  return issues
}
