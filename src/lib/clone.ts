// Глубокая копия JSON-данных (конфиги, формы). Работает и с реактивными объектами Vue на любой глубине:
// structuredClone падает на вложенных прокси, а toRaw снимает прокси только верхнего уровня.
export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
