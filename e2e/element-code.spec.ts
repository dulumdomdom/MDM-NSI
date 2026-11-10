// Модератор/администратор присваивает шифр прямо в карточке элемента: обходного листа для этого нет — шифр утверждается сразу.
import { expect, test, type Page } from '@playwright/test'

const pick = (page: Page, facetId: string, label: string) =>
  page.getByTestId('code-assign').getByTestId(`facet-${facetId}`).getByRole('radio', { name: label, exact: true }).click()
const fill = (page: Page, facetId: string, value: string) =>
  page.getByTestId('code-assign').getByTestId(`facet-${facetId}`).locator('input').fill(value)

test('присвоение шифра элементу из карточки', async ({ page }) => {
  await test.step('логин', async () => {
    await page.goto('/login')
    await page.getByTestId('login-input').fill('admin')
    await page.locator('#password').fill('admin')
    await page.getByTestId('login-submit').click()
    await expect(page.getByTestId('current-user')).toBeVisible()
  })

  await test.step('открыть элемент номенклатуры', async () => {
    await page.getByTestId('nav-/catalogs').click()
    await page.getByTestId('catalog-cat-nomenclature').click()
    await page.getByTestId('search-input').fill('Сверло ц/х')
    await page.getByTestId('dynamic-table').getByText('Сверло ц/х 6,5 ТС').click()
    await page.getByTestId('tab-codes').click()
  })

  await test.step('подобрать шифр в диалоге', async () => {
    await page.getByTestId('assign-cls-tool').click()
    await expect(page.getByTestId('code-assign')).toBeVisible()
    await pick(page, 'f-group', 'SV — Сверло')
    await pick(page, 'f-drill-type', '1 — спиральное')
    await pick(page, 'f-material', 'H — твёрдый сплав')
    await pick(page, 'f-coating', 'N — TiN')
    await fill(page, 'f-diameter', '5')
    await fill(page, 'f-length', '52')
    await pick(page, 'f-shank', 'C — цилиндрический')
    await pick(page, 'f-precision', 'H8')
    await pick(page, 'f-coolant', '0 — нет')
    await expect(page.getByTestId('code-assign').getByTestId('preview-code')).toHaveText('0H8C-52-5NH1SV')
    await page.getByTestId('assign-submit').click()
    await expect(page.getByTestId('element-code-cls-tool')).toContainText('Утверждён')
    await expect(page.getByTestId('element-code-cls-tool')).toContainText('0H8C-52-5NH1SV')
  })

})
