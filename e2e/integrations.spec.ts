// Интеграции с АСУ, 1С и Imbase: импорт стандартных изделий через заявки и выгрузка элемента из карточки.
import { expect, test } from '@playwright/test'
import { openAndLogin, toast } from './helpers'

test('обмен с внешними системами', async ({ page }) => {
  await openAndLogin(page, 'admin', 'admin')

  await test.step('импорт из Imbase создаёт заявки модераторам', async () => {
    await page.getByTestId('nav-/integrations').click()
    await expect(page.getByTestId('system-imbase')).toBeVisible()
    await page.getByTestId('run-fl-imbase-standard').click()
    await toast(page, 'Получено записей: 2')
    await page.getByRole('tab', { name: 'Журнал' }).click()
    await expect(page.getByTestId('journal')).toContainText('Винт А.М6-6gx20.58.016 ГОСТ 17473-80')
    await expect(page.getByTestId('journal')).toContainText('ждёт модераторов')
  })

  await test.step('повторный запуск не дублирует записи', async () => {
    await page.getByRole('tab', { name: 'Потоки обмена' }).click()
    await page.getByTestId('run-fl-imbase-standard').click()
    await toast(page, 'Новых записей нет')
  })

  await test.step('карточка элемента: идентификаторы во внешних системах', async () => {
    await page.getByTestId('nav-/catalogs').click()
    await page.getByTestId('catalog-cat-nomenclature').click()
    await page.getByTestId('search-input').fill('Сверло спиральное 6.5 TiAlN')
    await page.getByTestId('dynamic-table').getByText('Сверло спиральное Ø6.5×57 твёрдый сплав TiAlN').click()
    await page.getByTestId('tab-integrations').click()
    await expect(page.getByTestId('ext-1c')).toContainText('НФ-00012871')
    await expect(page.getByTestId('ext-imbase')).toContainText('IMB.0042.1187')
    await page.keyboard.press('Escape')
  })

  await test.step('выгрузка элемента в 1С из карточки', async () => {
    await page.getByTestId('search-input').fill('масло И-20А')
    await page.getByTestId('dynamic-table').getByText('Масло индустриальное И-20А').click()
    await page.getByTestId('tab-integrations').click()
    await expect(page.getByTestId('ext-1c')).toContainText('Ещё не передан')
    // Imbase принимает только элементы с утверждённым шифром инструмента
    await expect(page.getByTestId('ext-imbase')).toContainText('нет утверждённого шифра')
    await page.getByTestId('export-1c').click()
    await expect(page.getByTestId('ext-1c')).toContainText('НФ-')
    await expect(page.getByTestId('ext-1c')).toContainText('Синхронизирован')
  })
})
