// Пароли: SHA-512 + соль, парольная политика.
// ВАЖНО: в бою хэширование выполняет сервер. На клиенте эти функции используются только
// моками (MSW) и для мгновенной проверки политики в форме смены пароля.

import type { PasswordPolicy } from '@/types'

const toHex = (buf: ArrayBuffer): string =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

export async function sha512Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  return toHex(await globalThis.crypto.subtle.digest('SHA-512', data))
}

/** hash = SHA-512(salt + password) */
export function hashPassword(password: string, salt: string): Promise<string> {
  return sha512Hex(salt + password)
}

export function generateSalt(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  globalThis.crypto.getRandomValues(arr)
  return toHex(arr.buffer)
}

/** Нарушения политики сложности; пустой массив — пароль подходит */
export function validatePassword(password: string, policy: PasswordPolicy): string[] {
  const errors: string[] = []
  if (password.length < policy.minLength) errors.push(`Не короче ${policy.minLength} символов`)
  if (policy.requireUppercase && !/\p{Lu}/u.test(password)) errors.push('Нужна заглавная буква')
  if (policy.requireLowercase && !/\p{Ll}/u.test(password)) errors.push('Нужна строчная буква')
  if (policy.requireDigits && !/\d/.test(password)) errors.push('Нужна цифра')
  if (policy.requireSpecial && !/[^\p{L}\p{N}]/u.test(password)) errors.push('Нужен спецсимвол')
  return errors
}

/** Истёк ли срок действия пароля по политике */
export function isPasswordExpired(changedAt: string | undefined, policy: PasswordPolicy, now: Date = new Date()): boolean {
  if (policy.maxAgeDays <= 0 || !changedAt) return false
  const ageMs = now.getTime() - new Date(changedAt).getTime()
  return ageMs > policy.maxAgeDays * 24 * 60 * 60 * 1000
}

/** Повтор одного из N последних паролей */
export function isPasswordReused(newHash: string, history: readonly string[], policy: PasswordPolicy): boolean {
  if (policy.uniqueHistoryCount <= 0) return false
  return history.slice(-policy.uniqueHistoryCount).includes(newHash)
}
