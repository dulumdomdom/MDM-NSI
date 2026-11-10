// Запуск MSW в браузере. Service worker лежит в public/mockServiceWorker.js (в репозитории — работает офлайн).

import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'
import { runDueFlows } from './integration'
import { persistSoon, restorePersisted } from './persist'

export async function startMocks(): Promise<void> {
  // Демо-данные прошлых сеансов (если сид-данные в коде не менялись)
  restorePersisted()
  const worker = setupWorker(...handlers)
  // Каждое изменяющее действие сохраняет базу
  worker.events.on('response:mocked', ({ request }) => {
    if (request.method !== 'GET') persistSoon()
  })
  await worker.start({
    // Запросы мимо моков (шрифты, ассеты Vite) пропускаем молча
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    quiet: true,
  })
  // Таймер интеграций (ТЗ: обмен по расписанию): раз в минуту запускаем потоки, у которых подошёл срок
  setInterval(() => {
    if (runDueFlows().length) persistSoon()
  }, 60_000)
}
