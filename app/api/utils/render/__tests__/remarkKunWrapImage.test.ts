import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Node } from 'unist'
import { remarkKunWrapImage } from '../remarkKunWrapImage'

// 重构前的 O(M^2) splice-in-loop 实现，仅用于差分验证输出字节等价
const legacyWrapImage: Plugin<[], Node> = () => {
  return (tree: any) => {
    // @ts-expect-error Include a description after the "@ts-expect-error" directive
    visit(tree, 'element', (node: any, index: number | null, parent: any) => {
      if (!parent || index === null) return
      if (!/^h[1-6]$/.test(node.tagName)) return

      const headingText = (node.children || [])
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.value)
        .join('')
        .trim()

      if (headingText !== '游戏截图') {
        return
      }

      const siblings = parent.children
      const collected: any[] = []

      for (let j = index + 1; j < siblings.length;) {
        const sib = siblings[j]

        if (sib?.type === 'element' && /^h[1-6]$/.test(sib.tagName)) {
          break
        }

        const hasImg =
          sib?.type === 'element' &&
          (sib.tagName === 'img' ||
            (sib.tagName === 'p' &&
              sib.children?.some((ch: any) => ch.tagName === 'img')))

        if (hasImg) {
          collected.push(sib)
          siblings.splice(j, 1)
          continue
        }

        if (sib && sib.type === 'element') {
          break
        }

        j++
      }

      if (collected.length === 0) {
        return
      }

      const wrapper = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['data-kun-img-container'] },
        children: collected
      }

      siblings.splice(index + 1, 0, wrapper)
    })
  }
}

const render =
  (plugin: Plugin<[], Node>) =>
  (markdown: string): string =>
    String(
      unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(plugin)
        .use(rehypeStringify)
        .processSync(markdown)
    )

const renderNew = render(remarkKunWrapImage)
const renderLegacy = render(legacyWrapImage)

const img = (name: string) => `![${name}](https://example.com/${name}.jpg)`

const fixtures: Record<string, string> = {
  基本两图: `## 游戏截图\n\n${img('a')}\n\n${img('b')}\n\n## 下一节\n\n${img('c')}\n`,
  文档末尾无后继标题: `## 游戏截图\n\n${img('a')}\n\n${img('b')}\n`,
  中间夹说明段落即停止: `## 游戏截图\n\n${img('a')}\n\n这是一段说明文字\n\n${img('b')}\n`,
  紧跟非图片元素不包裹: `## 游戏截图\n\n这是一段说明\n\n${img('a')}\n`,
  无游戏截图标题: `## 别的标题\n\n${img('a')}\n`,
  大量图片: `## 游戏截图\n\n${Array.from({ length: 50 }, (_, i) => img(`s${i}`)).join('\n\n')}\n`
}

const extractWrapperInner = (html: string): string | null => {
  const m = html.match(/<div class="data-kun-img-container">([\s\S]*?)<\/div>/)
  return m ? m[1] : null
}

const countImg = (html: string): number => (html.match(/<img/g) || []).length

describe('remarkKunWrapImage', () => {
  // 核心保证：重构为线性一次性 splice 后，输出与旧 O(M^2) 实现逐字节一致
  it.each(Object.keys(fixtures))('与旧实现输出字节等价: %s', (key) => {
    const md = fixtures[key]
    expect(renderNew(md)).toBe(renderLegacy(md))
  })

  it('把游戏截图段落下的图片包进 data-kun-img-container，且不吞后续小节图片', () => {
    const html = renderNew(fixtures['基本两图'])
    const inner = extractWrapperInner(html)

    expect(inner).not.toBeNull()
    expect(inner).toContain('a.jpg')
    expect(inner).toContain('b.jpg')
    expect(inner).not.toContain('c.jpg')
    // 整篇 3 张图：2 张在 wrapper 内，c.jpg 独立在 wrapper 外
    expect(countImg(inner as string)).toBe(2)
    expect(countImg(html)).toBe(3)
  })

  it('大量连续图片全部收集进单个 wrapper', () => {
    const html = renderNew(fixtures['大量图片'])
    const inner = extractWrapperInner(html)

    expect(inner).not.toBeNull()
    expect(countImg(inner as string)).toBe(50)
    // 只应产生一个 wrapper
    expect(html.match(/data-kun-img-container/g)?.length).toBe(1)
  })

  it('无游戏截图标题时不产生 wrapper', () => {
    const html = renderNew(fixtures['无游戏截图标题'])
    expect(html).not.toContain('data-kun-img-container')
  })

  it('游戏截图后紧跟非图片元素时不产生 wrapper', () => {
    const html = renderNew(fixtures['紧跟非图片元素不包裹'])
    expect(html).not.toContain('data-kun-img-container')
  })
})
