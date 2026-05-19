import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,property,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/payload-types.ts'],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
