import { defineConfig, devices } from '@playwright/test'

// Браузер ставится в node_modules (PLAYWRIGHT_BROWSERS_PATH=0, см. npm run e2e:install),
// поэтому e2e работают офлайн после копирования проекта вместе с node_modules.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
