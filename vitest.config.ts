import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@main': resolve(__dirname, 'src/main'),
      '@': resolve(__dirname, 'src/renderer/src'),
      // Юнит-тесты запускаются вне Electron: подменяем модуль заглушкой.
      electron: resolve(__dirname, 'tests/stubs/electron.ts'),
      'electron-log/main': resolve(__dirname, 'tests/stubs/electron-log.ts')
    }
  },
  test: {
    globals: true,
    setupFiles: ['src/renderer/src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts'],
    // Тесты renderer объявляют окружение сами первой строкой файла:
    //   // @vitest-environment jsdom
    environment: 'node'
  }
})
