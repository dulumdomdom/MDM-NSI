// Сквозной сценарий: логин → классификатор → заполнение фасетов → «Записать» → заявка; затем дубликат вводом строки.
// Данные — из MSW-моков (src/mocks), учётка admin/admin — тестовая из сид-данных.
import { expect, test, type Page } from '@playwright/test'

/** Выбрать значение фасета-«кнопки» в мастере */
const pick = (page: Page, facetId: string, label: string) => page.getByTestId(`facet-${facetId}`).getByRole('radio', { name: label, exact: true }).click()
const fill = (page: Page, facetId: string, value: string) => page.getByTestId(`facet-${facetId}`).locator('input').fill(value)

test('мастер классификатора: заполнение, сохранение заявки и дубликат-чек', async ({ page }) => {
  await test.step('логин', async () => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
    await page.getByTestId('login-input').fill('admin')
    await page.locator('#password').fill('admin')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('current-user')).toHaveText('Администратор системы')
  })

  await test.step('открыть сложный классификатор', async () => {
    await page.getByTestId('nav-/classifiers').click()
    await page.getByTestId('classifier-cls-tool').click()
    await expect(page.getByTestId('facet-wizard')).toBeVisible()
  })

  await test.step('фасеты: заполнение списком сверху вниз', async () => {
    await pick(page, 'f-group', 'SV — Сверло')
    await pick(page, 'f-drill-type', '1 — спиральное')

    await pick(page, 'f-material', 'H — твёрдый сплав')
    await pick(page, 'f-coating', 'A — TiAlN')
    await fill(page, 'f-diameter', '8')
    await fill(page, 'f-length', '75')

    await pick(page, 'f-shank', 'C — цилиндрический')
    await pick(page, 'f-precision', 'H8')
    await pick(page, 'f-coolant', '1 — да')

    await fill(page, 'f-standard', 'ГОСТ10902')
  })

  await test.step('live-превью и расшифровка', async () => {
    // Шифр читается справа налево: группа SV — крайняя правая
    await expect(page.getByTestId('preview-code')).toHaveText('ГОСТ109021H8C-75-8AH1SV')
    await expect(page.getByTestId('decoded')).toContainText('Сверло спиральное Ø 8 мм, L 75 мм')
    await expect(page.getByTestId('short-name')).toHaveText('Сверло спиральное Ø8×75 H')
  })

  await test.step('записать → заявка создана', async () => {
    await page.getByTestId('save-entry').click()
    await expect(page.getByText('Заявка создана')).toBeVisible()
    await page.getByTestId('nav-/requests').click()
    await expect(page.getByTestId('requests-table')).toContainText('ГОСТ109021H8C-75-8AH1SV')
  })

  await test.step('дубликат: тот же шифр строкой не создаёт вторую заявку', async () => {
    await page.getByTestId('nav-/classifiers').click()
    await page.getByTestId('classifier-cls-tool').click()
    await page.getByTestId('code-input').fill('ГОСТ109021H8C-75-8AH1SV')
    await page.getByTestId('save-entry').click()
    await expect(page.getByTestId('duplicate-message')).toContainText('уже на согласовании')
  })
})
