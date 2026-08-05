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
    // standalone 构建会复制整份项目目录, 残留的构建目录里有一套 __tests__ 副本会被收集;
    // 显式 exclude 会整体覆盖 Vitest 默认值 (含 node_modules), 故必须展开 configDefaults
    exclude: [
      ...configDefaults.exclude,
      '.next/**',
      '.next-deploy/**',
      '.next-previous/**'
    ]
  }
})
