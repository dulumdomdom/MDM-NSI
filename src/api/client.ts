// HTTP-клиент: axios + interceptors (токен, нормализация ошибок, 401 → выход).
// Store'ы не импортируются напрямую (иначе цикл) — провайдеры подключаются в main.ts.

import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { API_BASE } from './endpoints'
import { ApiError, isApiErrorBody } from './common'

let tokenProvider: () => string | null = () => null
let onUnauthorized: () => void = () => undefined

export function setAuthTokenProvider(fn: () => string | null): void {
  tokenProvider = fn
}

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn
}

export const http = axios.create({
  baseURL: API_BASE,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  const token = tokenProvider()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (err instanceof AxiosError) {
      const status = err.response?.status ?? 0
      if (status === 401) onUnauthorized()
      const data: unknown = err.response?.data
      const body = isApiErrorBody(data)
        ? data
        : { code: status === 0 ? 'NETWORK' : `HTTP_${status}`, message: status === 0 ? 'Сервер недоступен' : err.message }
      return Promise.reject(new ApiError(status, body))
    }
    return Promise.reject(err instanceof Error ? err : new Error(String(err)))
  },
)

/** Типизированные обёртки: возвращают сразу data */
export const api = {
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return (await http.get<T>(url, config)).data
  },
  async post<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
    return (await http.post<T>(url, body, config)).data
  },
  async put<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
    return (await http.put<T>(url, body, config)).data
  },
  async delete<T = void>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return (await http.delete<T>(url, config)).data
  },
}
