// Сквозная проверка форм настройки: роли и пользователи, новый справочник (структура, привязка, согласование),
// новый классификатор (фасет, структура, расшифровка) — и что настроенное сразу работает.
import { expect, test, type Locator, type Page } from '@playwright/test'

/** Выбрать значение в PrimeVue Select: открыть список и кликнуть вариант */
async function choose(page: Page, select: Locator, option: string): Promise<void> {
  await select.click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

const toast = (page: Page, text: string) => expect(page.locator('.p-toast').getByText(text).first()).toBeVisible()

async function login(page: Page): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('login-input').fill('admin')
  await page.locator('#password').fill('admin')
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('current-user')).toBeVisible()
}

test('роли и пользователи: создать роль и назначить её в области', async ({ page }) => {
  await login(page)
  await page.getByTestId('nav-/admin').click()

  await test.step('создать роль', async () => {
    await page.getByRole('tab', { name: /Роли/ }).click()
    await page.getByRole('button', { name: 'Создать роль' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.locator('#rd-name').fill('Контролёр качества')
    // Матрица: строка «Справочники», колонки «Просмотр» и «Согласование»
    const row = dlg.getByRole('row', { name: /Справочники/ })
    await row.getByRole('checkbox').nth(0).check()
    await row.getByRole('checkbox').nth(5).check()
    await dlg.getByRole('button', { name: 'Создать' }).click()
    await toast(page, 'Роль создана')
    await expect(page.getByText('Контролёр качества')).toBeVisible()
  })

  await test.step('назначить роль пользователю на справочник', async () => {
    await page.getByRole('tab', { name: /Пользователи/ }).click()
    await page.getByRole('button', { name: 'Никитина Елена Владимировна' }).click()
    const dlg = page.getByRole('dialog')
    await dlg.getByRole('button', { name: 'Назначить роль' }).click()
    const last = dlg.locator('.grid.grid-cols-\\[1fr_1\\.3fr_40px\\]').last()
    await choose(page, last.locator('.p-select').first(), 'Контролёр качества')
    await choose(page, last.locator('.p-select').nth(1), 'Номенклатура')
    await dlg.getByRole('button', { name: 'Сохранить' }).click()
    await toast(page, 'Пользователь сохранён')
    await expect(page.getByText('Контролёр качества · Справочник: Номенклатура')).toBeVisible()
  })
})

test('новый справочник: структура, привязка классификатора, обходной лист', async ({ page }) => {
  await login(page)
  await page.getByTestId('nav-/catalogs').click()

  await test.step('создать', async () => {
    await page.getByTestId('catalog-create').click()
    await page.getByTestId('prompt-input').fill('Оборудование цеха')
    await page.getByTestId('prompt-submit').click()
    await expect(page).toHaveURL(/tab=structure/)
    await expect(page.getByRole('heading', { name: 'Оборудование цеха' })).toBeVisible()
  })

  await test.step('добавить атрибуты и сохранить структуру', async () => {
    await page.getByTestId('attr-add').click()
    await page.getByTestId('prompt-input').fill('Инвентарный номер')
    await page.getByTestId('prompt-submit').click()
    await page.getByTestId('attr-add').click()
    await page.getByTestId('prompt-input').fill('Мощность, кВт')
    await choose(page, page.getByRole('dialog').locator('.p-select'), 'Дробное число')
    await page.getByTestId('prompt-submit').click()
    await expect(page.getByText('Инвентарный номер')).toBeVisible()
    await page.getByTestId('config-save').click()
    await toast(page, 'Структура справочника сохранена')
  })

  await test.step('привязать классификатор', async () => {
    await page.getByRole('tab', { name: 'Классификаторы' }).click()
    await choose(page, page.locator('.p-select', { hasText: 'Привязать классификатор' }), 'Классификатор материалов')
    await page.getByRole('button', { name: 'Привязать', exact: true }).click()
    await page.getByTestId('config-save').click()
    await toast(page, 'Структура справочника сохранена')
  })

  await test.step('настроить обходной лист пополнения', async () => {
    await page.getByRole('tab', { name: 'Согласование' }).click()
    const card = page.locator('section', { hasText: 'Заявка пользователя на новый элемент' })
    await card.getByRole('button', { name: 'Настроить свой обходной лист' }).click()
    await card.getByRole('button', { name: 'Проверка' }).click()
    await card.getByPlaceholder('Что делает ответственный').last().fill('Проверка главного механика')
    await choose(page, card.locator('.p-select', { hasText: 'Модератор' }).last(), 'Модератор')
    await card.getByRole('button', { name: 'Сохранить' }).click()
    await toast(page, 'Обходной лист сохранён')
  })

  await test.step('администратор вносит элемент напрямую', async () => {
    await page.getByRole('tab', { name: 'Элементы' }).click()
    await page.getByTestId('element-add').click()
    await page.locator('#attr-name').fill('Станок токарный 16К20')
    await page.getByTestId('element-save').click()
    await toast(page, 'Элемент добавлен')
    await expect(page.getByTestId('dynamic-table')).toContainText('Станок токарный 16К20')
  })
})

test('новый классификатор: фасет, структура, расшифровка — и ввод шифра', async ({ page }) => {
  await login(page)
  await page.getByTestId('nav-/classifiers').click()

  await test.step('создать', async () => {
    await page.getByTestId('classifier-create').click()
    await page.getByTestId('prompt-input').fill('Классификатор оборудования')
    await page.getByTestId('prompt-submit').click()
    await expect(page).toHaveURL(/tab=settings/)
  })

  await test.step('добавить фасет со значениями', async () => {
    await page.getByTestId('facet-add').click()
    await page.getByTestId('prompt-input').fill('Вид оборудования')
    await page.getByTestId('prompt-submit').click()
    const dlg = page.getByRole('dialog')
    await expect(dlg.locator('#ff-name')).toHaveValue('Вид оборудования')
    await dlg.locator('#ff-len').fill('2')
    await dlg.getByRole('tab', { name: /Значения/ }).click()
    await dlg.locator('textarea').fill('TK = Токарное\nFR = Фрезерное')
    await dlg.getByRole('button', { name: 'Применить' }).click()
    await expect(page.getByText('нет', { exact: true })).toBeVisible() // фасет ещё не в дереве
  })

  await test.step('поставить фасет в структуру и сохранить', async () => {
    await page.getByRole('tab', { name: 'Структура' }).click()
    await page.locator('[data-testid=facet-tree]:visible').getByText('Основной каталог').click()
    await choose(page, page.locator('.p-select', { hasText: 'Фасет следующей ноды' }), 'Вид оборудования')
    await page.getByRole('button', { name: 'Добавить', exact: true }).click()
    await page.getByTestId('config-save').click()
    await toast(page, 'Конфигурация сохранена')
  })

  await test.step('структура расшифровки и краткое наименование', async () => {
    await page.getByRole('tab', { name: 'Расшифровка' }).click()
    await page.getByRole('button', { name: 'Структура', exact: true }).click()
    await page.getByRole('button', { name: 'Часть', exact: true }).click()
    await page.getByPlaceholder('{f-group} {f-type}[ Ø{f-diameter:code}]').fill('Станок {f-vid-oborudovaniya}')
    await page.getByTestId('config-save').click()
    await toast(page, 'Конфигурация сохранена')
  })

  await test.step('настроенный классификатор работает во вводе', async () => {
    await page.getByRole('tab', { name: 'Ввод шифра' }).click()
    await page.getByTestId('facet-f-vid-oborudovaniya').getByRole('radio', { name: 'TK — Токарное', exact: true }).click()
    await expect(page.getByTestId('preview-code').first()).toHaveText('TK')
    await expect(page.getByTestId('decoded')).toHaveText('Токарное')
  })
})
