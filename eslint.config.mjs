import { fixupConfigRules } from '@eslint/compat'
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import react from 'eslint-plugin-react'

export default defineConfig([
  globalIgnores(['.next/', 'node_modules/', 'prisma/generated/']),
  // eslint-plugin-react / import / jsx-a11y 仍用 ESLint 10 已移除的旧 context API, 须经 fixup 桥接
  ...fixupConfigRules(nextCoreWebVitals),
  js.configs.recommended,
  ...fixupConfigRules([react.configs.flat.recommended]),
  ...fixupConfigRules(nextTypescript),
  prettierRecommended,
  {
    settings: {
      'import/ignore': ['node_modules'],
      react: {
        version: 'detect'
      }
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      // 格式选项以 .prettierrc.json 为单一事实源, eslint-plugin-prettier 会自行解析
      'prettier/prettier': 'error',
      'no-debugger': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'warn',
      // ESLint 10 recommended 新增; 存量代码为「let 初始值 + 分支覆盖」风格, 维持升级前基线
      'no-useless-assignment': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'off',
      // eslint-plugin-react-hooks v7 新增的编译器规则, 对存量代码大面积报错, 维持升级前基线
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/immutability': 'off'
    }
  }
])
