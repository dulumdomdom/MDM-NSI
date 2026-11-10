// Общие шаги e2e. Важно: переходы и смена пользователя — без перезагрузки страницы,
// иначе in-memory база моков (MSW) сбросится и данные предыдущих шагов пропадут.
import { expect, type Page } from '@playwright/test'

/** Первый вход — с загрузкой страницы */
export async function openAndLogin(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login')
  await signIn(page, login, password)
}

export async function signIn(page: Page, login: string, password: string): Promise<void> {
  await page.getByTestId('login-input').fill(login)
  await page.locator('#password').fill(password)
  await page.getByTestId('login-submit').click()
  await expect(page.getByTestId('current-user')).toBeVisible()
}

/** Выход через меню пользователя (SPA, без перезагрузки) */
export async function signOut(page: Page): Promise<void> {
  // Открытая карточка заявки перекрывает шапку — закрываем
  if (await page.locator('.p-drawer').isVisible()) {
    await page.keyboard.press('Escape')
    await expect(page.locator('.p-drawer')).toBeHidden()
  }
  await page.getByRole('button', { name: 'Меню пользователя' }).click()
  await page.getByText('Выйти', { exact: true }).click()
  await expect(page.getByTestId('login-form')).toBeVisible()
}

export const toast = (page: Page, text: string) => expect(page.locator('.p-toast').getByText(text).first()).toBeVisible()
