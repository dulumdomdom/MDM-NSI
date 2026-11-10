// Замещение: Орлов в отпуске — его строку заявки (обозначение крепежа) закрывает заместитель Захарова.
// Решение подписано «за Орлова» и видно в журнале действий администратора.
import { expect, test, type Page } from '@playwright/test'
import { openAndLogin, signIn, signOut } from './helpers'

const pick = (page: Page, facetId: string, label: string) =>
  page.getByTestId('code-assign').getByTestId(`facet-${facetId}`).getByRole('radio', { name: label, exact: true }).click()

test('заместитель решает строку за отсутствующего, действие в журнале', async ({ page }) => {
  await test.step('заместитель видит, кого замещает, и строку на подпись', async () => {
    await openAndLogin(page, 'zakharova', 'zakharova')
    await expect(page.getByTestId('delegation-banner')).toContainText('Орлов Дмитрий Николаевич')
    await page.getByTestId('nav-/requests').click()
    await page.getByTestId('request-req-7').click()
    await expect(page.getByTestId('step-st-enc-fastener')).toContainText('Решение за Орлов Дмитрий Николаевич')
    await expect(page.getByTestId('due-st-review')).toContainText('просрочено')
  })

  await test.step('обозначение гайки по ГОСТ — за Орлова', async () => {
    await page.getByTestId('encode-st-enc-fastener').click()
    await expect(page.getByTestId('code-assign')).toBeVisible()
    await pick(page, 'fx-type', 'Г — Гайка')
    await pick(page, 'fx-exec', '1 — исполнение 1')
    await pick(page, 'fx-d', '20 — М20')
    await pick(page, 'fx-pitch', 'К — крупный')
    await pick(page, 'fx-class', '8')
    await pick(page, 'fx-cover', '016 — цинковое хроматированное 6 мкм')
    await pick(page, 'fx-std', '5915-70 — нормальной точности')
    await expect(page.getByTestId('code-assign').getByTestId('preview-code')).toHaveText('Г1-20-К-8-016-5915-70')
    await page.getByTestId('assign-submit').click()
    await expect(page.getByTestId('step-st-enc-fastener')).toContainText('Г1-20-К-8-016-5915-70')
    await expect(page.getByTestId('step-st-enc-fastener')).toContainText('за Орлов Дмитрий Николаевич')
    await signOut(page)
  })

  await test.step('администратор: запись в журнале действий', async () => {
    await signIn(page, 'admin', 'admin')
    await page.getByTestId('nav-/audit').click()
    const journal = page.getByTestId('audit-table')
    await expect(journal).toContainText('Условное обозначение крепежа по ГОСТ» согласована')
    await expect(journal).toContainText('за Орлов Дмитрий Николаевич')
    await page.getByLabel('Поиск по журналу').fill('заместитель')
    await expect(journal).toContainText('Назначен заместитель')
    await expect(journal).not.toContainText('согласована')
  })
})

test('кладовщик видит номенклатуру без цен; выгрузка в CSV — только видимые колонки', async ({ page }) => {
  await page.goto('/login')
  await page.getByText('Войти через домен (LDAP)').click()
  await signIn(page, 'nikitina', 'ldap')
  await page.getByTestId('nav-/catalogs').click()
  await page.getByTestId('catalog-cat-nomenclature').click()
  await page.getByTestId('search-input').fill('Болт М12')
  const table = page.getByTestId('dynamic-table')
  await expect(table).toContainText('Болт М12-6g×50.88.016')
  await expect(table).not.toContainText('Цена')
  const download = page.waitForEvent('download')
  await page.getByTestId('catalog-export').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^Номенклатура_\d{4}-\d{2}-\d{2}\.csv$/)
  const path = await file.path()
  const { readFileSync } = await import('node:fs')
  const csv = readFileSync(path, 'utf-8')
  expect(csv).toContain('Болт М12-6g×50.88.016')
  expect(csv).not.toContain('Цена')
})
