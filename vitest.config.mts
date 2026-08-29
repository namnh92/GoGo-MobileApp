import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve('./src'),
      // The API layer is plain TypeScript except for two Expo native modules.
      // Stubbing only those lets the tests exercise the client the app ships,
      // rather than a Node-shaped copy of it.
      'expo-secure-store': resolve('./src/shared/api/__tests__/stubs/expo-secure-store.ts'),
      'expo-crypto': resolve('./src/shared/api/__tests__/stubs/expo-crypto.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // `src/shared/config/env.ts` validates these at import time and throws
      // when they are missing, so they must exist before any module loads.
      EXPO_PUBLIC_ENV: 'dev',
      // Unit tests never reach the network. The contract suite does, and runs
      // only under GOGO_CONTRACT_TEST=1 — it takes whatever backend the caller
      // exports rather than writing rooms into the shared dev environment by
      // default.
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/v1',
      EXPO_PUBLIC_WEB_BASE_URL: 'https://go-dev.gogo.id.vn',
    },
    // The contract suite drives one room through a stateful flow, so its steps
    // must run in order.
    fileParallelism: false,
    testTimeout: 30_000,
  },
})
