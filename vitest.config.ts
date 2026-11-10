import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // lib/ и stores/ не трогают DOM — достаточно node-окружения
      environment: 'node',
      include: ['src/**/*.spec.ts'],
      exclude: ['e2e/**', 'node_modules/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
