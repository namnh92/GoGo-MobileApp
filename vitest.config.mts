import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@': resolve('./src') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // `src/shared/config/env.ts` validates these at import time and throws
      // when they are missing, so they must exist before any module loads.
      EXPO_PUBLIC_ENV: 'dev',
      EXPO_PUBLIC_API_URL: 'http://localhost:3000/v1',
      EXPO_PUBLIC_WEB_BASE_URL: 'https://gogo.app',
    },
  },
})
