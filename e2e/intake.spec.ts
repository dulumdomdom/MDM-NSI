// Главный сценарий системы:
//  пользователь вводит наименование → не найдено → заявка на пополнение с полями из запроса →
//  группа подсказана по похожей позиции и задаёт маршрут → модератор инструмента получает уведомление,
//  шифрует и проверяет →
//  заявка обработана → позиция в справочнике, автору — уведомление.
//  И корректировка найденной позиции без смены шифра — вносится сразу.
import { expect, test, type Page } from '@playwright/test'
import { openAndLogin, signIn, signOut, toast } from './helpers'

const pick = (page: Page, facetId: string, label: string) =>
  page.getByTestId('code-assign').getByTestId(`facet-${facetId}`).getByRole('radio', { name: label, exact: true }).click()
const fill = (page: Page, facetId: string, value: string) =>
  page.getByTestId('code-assign').getByTestId(`facet-${facetId}`).locator('input').fill(value)

/** Открыть заявку из колокольчика */
async function openFromBell(page: Page, text: string): Promise<void> {
  await expect(page.getByTestId('notifications-count')).toBeVisible()
  await page.getByTestId('notifications').click()
  await page.locator('.p-popover').getByText(text).first().click()
  await expect(page.locator('.p-drawer')).toBeVisible()
}

test('пополнение: пользователь → модераторы → справочник', async ({ page }) => {
  await test.step('пользователь: не нашёл позицию и отправил заявку с разобранными полями', async () => {
    await openAndLogin(page, 'user', 'user')
    await page.getByTestId('nav-/intake').click()
    await page.getByTestId('intake-query').fill('Сверло спиральное 5×52 TiN, шт; Артикул: SV-5-52-N')
    await expect(page.getByTestId('intake-results')).toBeVisible()
    await page.getByTestId('intake-new').click()
    // Поля заполнены из запроса
    await expect(page.locator('#intake-name')).toHaveValue('Сверло спиральное 5×52 TiN')
    await expect(page.locator('#intake-article')).toHaveValue('SV-5-52-N')
    // Группа подсказана по похожему сверлу — значит, шифровать будет модератор инструмента
    await expect(page.getByTestId('group-suggested')).toBeVisible()
    await page.getByTestId('intake-submit').click()
    await expect(page.getByTestId('intake-done')).toContainText('отправлена')
    await signOut(page)
  })

  await test.step('модератор инструмента: уведомление, шифрование, проверка', async () => {
    await signIn(page, 'petrov', 'petrov')
    await openFromBell(page, 'шифрование по классификатору инструмента')
    await page.getByTestId('encode-st-enc-tool').click()
    await expect(page.getByTestId('code-assign')).toBeVisible()
    await pick(page, 'f-group', 'SV — Сверло')
    await pick(page, 'f-drill-type', '1 — спиральное')
    await pick(page, 'f-material', 'P — быстрорежущая сталь')
    await pick(page, 'f-coating', 'N — TiN')
    await fill(page, 'f-diameter', '5')
    await fill(page, 'f-length', '52')
    await pick(page, 'f-shank', 'C — цилиндрический')
    await pick(page, 'f-precision', 'H8')
    await pick(page, 'f-coolant', '0 — нет')
    await page.getByTestId('assign-submit').click()
    await expect(page.getByTestId('step-st-enc-tool')).toContainText('0H8C-52-5NP1SV')
    await page.getByTestId('approve-st-review').click()
    await toast(page, 'изменения внесены в справочник')
    await signOut(page)
  })

  await test.step('пользователь: уведомление об итоге и позиция в справочнике с шифром', async () => {
    await signIn(page, 'user', 'user')
    await page.getByTestId('notifications').click()
    await expect(page.locator('.p-popover').getByText('Заявка обработана').first()).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByTestId('nav-/intake').click()
    await page.getByTestId('intake-query').fill('сверло 5x52 tin')
    await expect(page.getByTestId('intake-results')).toContainText('Сверло спиральное 5×52 TiN')
    await expect(page.getByTestId('intake-results')).toContainText('0H8C-52-5NP1SV')
  })
})

test('корректировка найденной позиции без смены шифра вносится сразу', async ({ page }) => {
  await openAndLogin(page, 'user', 'user')
  await page.getByTestId('nav-/intake').click()
  // Опечатка и запятая в размере — поиск всё равно находит
  await page.getByTestId('intake-query').fill('свирло спиральное 6,5')
  await page.getByTestId('pick-n-0001').click()
  await page.locator('#intake-minBatch').fill('25')
  await page.locator('#intake-minBatch').blur()
  await expect(page.getByText('Корректировка будет внесена сразу')).toBeVisible()
  await page.getByTestId('intake-submit').click()
  await expect(page.getByTestId('intake-done')).toContainText('Изменения внесены')
})
