// Генерация технических id из человеческих названий: «Длина рабочей части» → «dlina-rabochei-chasti».

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

export function slugify(text: string, maxLength = 32): string {
  const s = Array.from(text.toLowerCase())
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, maxLength).replace(/-+$/, '')
}

/** Уникальный id с префиксом: prefix-slug, при совпадении — prefix-slug-2, -3… */
export function uniqueId(prefix: string, name: string, taken: Iterable<string>): string {
  const used = new Set(taken)
  const base = [prefix, slugify(name) || 'item'].filter(Boolean).join('-')
  if (!used.has(base)) return base
  let i = 2
  while (used.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}
