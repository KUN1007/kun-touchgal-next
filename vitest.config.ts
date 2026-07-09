import { fileURLToPath } from 'url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url))
    }
  },
  test: {
    include: [
      'server/search/__tests__/**/*.test.ts',
      'app/api/user/follow/__tests__/**/*.test.ts'
    ]
  }
})
