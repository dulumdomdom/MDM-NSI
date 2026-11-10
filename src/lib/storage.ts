// Безопасный доступ к localStorage: в node/тестах и приватном режиме его может не быть.
export function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}
