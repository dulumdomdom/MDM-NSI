// Поиск (ТЗ): контекстный, неточный, по маске. Чистые функции.

import type { SearchMode } from '@/types'

/** Нормализация для сравнения: регистр, ё→е, лишние пробелы */
export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

/** Расстояние Левенштейна (O(n·m), память O(m)) */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] ?? 0
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      prev[j] = Math.min((prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + 1, diag + cost)
      diag = tmp
    }
  }
  return prev[b.length] ?? 0
}

/** Сходство 0..1 */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length)
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max
}

/** Маска: * — любая последовательность, ? — один символ. Совпадение по всей строке */
export function maskToRegExp(mask: string): RegExp {
  const src = Array.from(mask)
    .map((ch) => (ch === '*' ? '.*' : ch === '?' ? '.' : ch.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
    .join('')
  return new RegExp(`^${src}$`, 'iu')
}

export const FUZZY_THRESHOLD = 0.7

/**
 * Неточное совпадение: запрос сравнивается с каждым окном слов текста той же длины.
 * «свирло» найдёт «Сверло спиральное».
 */
export function fuzzyMatch(text: string, query: string, threshold = FUZZY_THRESHOLD): boolean {
  const t = normalizeText(text)
  const q = normalizeText(query)
  if (q === '' || t.includes(q)) return true
  const words = t.split(' ')
  const qLen = q.split(' ').length
  for (let i = 0; i + qLen <= words.length; i++) {
    if (similarity(words.slice(i, i + qLen).join(' '), q) >= threshold) return true
  }
  return false
}

export function matchesSearch(text: string, query: string, mode: SearchMode): boolean {
  if (query.trim() === '') return true
  switch (mode) {
    case 'context':
      return normalizeText(text).includes(normalizeText(query))
    case 'fuzzy':
      return fuzzyMatch(text, query)
    case 'mask':
      return maskToRegExp(query.trim()).test(text.trim())
    default: {
      const exhaustive: never = mode
      return exhaustive
    }
  }
}

/** Отбор элементов: совпадение по любому из текстовых полей */
export function searchItems<T>(items: readonly T[], texts: (item: T) => string[], query: string, mode: SearchMode): T[] {
  if (query.trim() === '') return [...items]
  return items.filter((it) => texts(it).some((t) => matchesSearch(t, query, mode)))
}
