import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// kun-video / kun-link 曾在 schema 的 toDOM 里 createRoot 渲染 React 组件: ProseMirror
// 对普通 toDOM 节点的销毁路径没有任何回调, root 永不 unmount, KunPlyr 的 effect
// cleanup 不跑, 每个 Plyr 实例向 document 注册的监听把整棵 fiber 树钉住; 复制选区
// 时 PM 也会调 toDOM 序列化, 每按一次 Ctrl+C 多漏一个播放器。编辑器内的 React 渲染
// 一律走 @prosemirror-adapter 的 nodeView / pluginView, 卸载由 adapter 负责。
const milkdownDir = fileURLToPath(new URL('../', import.meta.url))

const sourceFiles = readdirSync(milkdownDir, {
  recursive: true,
  encoding: 'utf-8'
}).filter((entry) => /\.tsx?$/.test(entry) && !entry.includes('__tests__'))

describe('milkdown 目录不得绕开 adapter 直接 createRoot', () => {
  it('没有文件导入 react-dom/client', () => {
    expect(sourceFiles.length).toBeGreaterThan(0)

    const offenders = sourceFiles.filter((file) =>
      /['"]react-dom\/client['"]/.test(
        readFileSync(join(milkdownDir, file), 'utf-8')
      )
    )

    expect(offenders).toEqual([])
  })
})
