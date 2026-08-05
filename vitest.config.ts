import { fileURLToPath } from 'url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./', import.meta.url))
    }
  },
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    // 构建目录 (standalone 会复制整份项目) 与 Agent worktree 都藏着 __tests__ 副本,
    // 陈旧副本会 FAIL; 显式 exclude 会整体覆盖 Vitest 默认值 (含 node_modules),
    // 故必须展开 configDefaults
    exclude: [
      ...configDefaults.exclude,
      '.next/**',
      '.next-deploy/**',
      '.next-previous/**',
      '.claude/**'
    ]
  }
})
