// Демо-данные переживают перезагрузку страницы: «база» моков сохраняется в localStorage браузера.
// Сохранение привязано к версии сид-данных — после обновления данных в коде старая копия не используется.

import { safeStorage } from '@/lib/storage'
import { db, replaceDb, resetDb, seedVersion, type MockDb } from './db'

const KEY = 'mdm.demo-db'

interface Saved {
  version: string
  savedAt: string
  data: MockDb
}

/** Поднять сохранённую базу, если она от тех же сид-данных */
export function restorePersisted(): boolean {
  try {
    const raw = safeStorage()?.getItem(KEY)
    if (!raw) return false
    const saved = JSON.parse(raw) as Saved
    if (saved.version !== seedVersion) return false
    replaceDb(saved.data)
    return true
  } catch {
    return false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined

/** Сохранить с задержкой: серия запросов пишется одним разом */
export function persistSoon(): void {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try {
      const saved: Saved = { version: seedVersion, savedAt: new Date().toISOString(), data: db }
      safeStorage()?.setItem(KEY, JSON.stringify(saved))
    } catch {
      // Переполнение или запрет хранилища — работаем без сохранения
    }
  }, 400)
}

/** Сброс к исходным демо-данным */
export function resetPersisted(): void {
  clearTimeout(timer)
  safeStorage()?.removeItem(KEY)
  resetDb()
}
