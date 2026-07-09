import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    envFile: './.env.test',
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 15000,
  },
})
