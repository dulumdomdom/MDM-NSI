// Дымовая проверка офлайн-пакета: обычный Chromium открывает запущенный serve.ps1 / serve.py,
// входит под администратором и доходит до справочника. Запуск: node scripts/smoke-offline.mjs [url]
// (Chromium — из node_modules: PLAYWRIGHT_BROWSERS_PATH=0)

import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'http://localhost:8080/'
const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

try {
  await page.goto(url)
  await page.getByTestId('login-input').fill('admin')
  await page.locator('#password').fill('admin')
  await page.getByTestId('login-submit').click()
  await page.getByTestId('current-user').waitFor()
  await page.goto(new URL('/catalogs/cat-nomenclature', url).href)
  await page.getByTestId('search-input').fill('Болт М12')
  await page.getByText('Болт М12-6g×50.88.016').first().waitFor()
  console.info('OK: вход и справочник работают', url)
} catch (e) {
  console.error('FAIL:', e instanceof Error ? e.message : e, errors)
  process.exitCode = 1
} finally {
  await browser.close()
}
