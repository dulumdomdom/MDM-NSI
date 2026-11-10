// Выгрузка таблиц в CSV для Excel (русская локаль): разделитель «;», BOM для кириллицы, кавычки по RFC 4180.

export interface CsvColumn<T> {
  title: string
  value: (row: T) => string | number | null | undefined
}

const cell = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return ''
  // Дробные — с запятой, как ждёт Excel в русской локали
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => cell(c.title)).join(';')
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(';'))
  return '﻿' + [head, ...body].join('\r\n')
}

/** Скачать файл в браузере (без сервера — работает офлайн) */
export function downloadText(fileName: string, text: string, mime = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Имя файла: «Номенклатура_2026-11-05.csv» */
export const csvName = (title: string, now: Date = new Date()): string =>
  `${title.replace(/[\\/:*?"<>|\s]+/g, '_')}_${now.toISOString().slice(0, 10)}.csv`
