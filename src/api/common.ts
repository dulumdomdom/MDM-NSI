// Общие контракты API: нормализованная ошибка.

import type { ApiErrorBody } from '@/types'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: Record<string, string>

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

export function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === 'object' && v !== null && 'code' in v && 'message' in v && typeof v.message === 'string'
}

/** Человекочитаемый текст любой ошибки (для toast) */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message
  if (e instanceof Error) return e.message
  return 'Неизвестная ошибка'
}
