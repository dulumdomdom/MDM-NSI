// Модель формы по схеме атрибутов: значения, значения по умолчанию, валидация.

import { computed, ref, toValue, type MaybeRefOrGetter } from 'vue'
import { defaultValue, validateAll } from '@/lib/attributes'
import type { AttributeValue, CatalogAttribute } from '@/types'

export function useDynamicForm(attributes: MaybeRefOrGetter<CatalogAttribute[]>) {
  const model = ref<Record<string, AttributeValue>>({})
  const errors = ref<Record<string, string>>({})
  const initial = ref('')

  /** Заполнить модель: значения элемента поверх значений по умолчанию */
  function reset(values: Readonly<Record<string, AttributeValue>> = {}): void {
    model.value = Object.fromEntries(toValue(attributes).map((a) => [a.id, values[a.id] ?? defaultValue(a)]))
    errors.value = {}
    initial.value = JSON.stringify(model.value)
  }

  function setField(id: string, value: AttributeValue): void {
    model.value = { ...model.value, [id]: value }
    // Ошибку поля снимаем сразу при правке
    if (Object.keys(errors.value).some((k) => k === id || k.startsWith(`${id}.`))) {
      errors.value = Object.fromEntries(Object.entries(errors.value).filter(([k]) => k !== id && !k.startsWith(`${id}.`)))
    }
  }

  function validate(): boolean {
    errors.value = validateAll(toValue(attributes), model.value)
    return Object.keys(errors.value).length === 0
  }

  const dirty = computed(() => JSON.stringify(model.value) !== initial.value)

  return { model, errors, dirty, reset, setField, validate }
}
