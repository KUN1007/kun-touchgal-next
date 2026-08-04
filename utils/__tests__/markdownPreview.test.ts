import { describe, expect, it } from 'vitest'
import { markdownToPreviewHtml } from '~/utils/markdownPreview'

const XSS_PAYLOAD = '<img src=x onerror=alert(1)>'

// escapeHtml 已转掉用户文本里的 ", 所以输出中每个 " 都是我们生成的属性分隔符,
// 奇数段即属性值。属性值里出现裸 < 或 > 就说明用户文本截断了属性
const hasAttributeBreakout = (html: string) =>
  html
    .split('"')
    .some((segment, index) => index % 2 === 1 && /[<>]/.test(segment))

describe('markdownToPreviewHtml', () => {
  it('所有行内上下文的原始 HTML 均被转义', () => {
    const cases = [
      `hello ${XSS_PAYLOAD} world`,
      `# ${XSS_PAYLOAD}`,
      `###### ${XSS_PAYLOAD}`,
      `- ${XSS_PAYLOAD}`,
      `1. ${XSS_PAYLOAD}`,
      `> ${XSS_PAYLOAD}`,
      `|${XSS_PAYLOAD}|\n|---|`,
      `**bold** <script>alert(1)</script>`
    ]

    for (const markdown of cases) {
      const html = markdownToPreviewHtml(markdown)
      expect(html).not.toMatch(/<(?:img|script|svg)\b/)
      expect(html).toContain('&lt;')
    }
  })

  it('图片与链接的属性值不可被闭合逃逸', () => {
    const cases = [
      // 用户自带引号
      '![a](x" onerror="alert(1))',
      '[a](x" onmouseover="alert(1))',
      // 借前一条规则生成的引号截断属性: 链接语法藏在图片 src 里
      '![a](q[w](x onerror=location=name )X)',
      '![a](q[w](x onerror=location=name)X)',
      '![a](q[w](x onerror=location=name )![b](c[d](e onerror=location=name )f)',
      // 同源的良性表现: 后续规则匹配到生成标签内部
      '[a](x*y)*z*',
      '[a](x`y)`z`'
    ]

    for (const markdown of cases) {
      expect(hasAttributeBreakout(markdownToPreviewHtml(markdown))).toBe(false)
    }

    // 反空转: 检测器必须能认出被截断的属性, 否则上面的断言恒真
    expect(
      hasAttributeBreakout('<img src="q<a href="x onerror=alert" alt="a" />')
    ).toBe(true)
  })

  it('代码块内容仍被转义', () => {
    expect(markdownToPreviewHtml(`\`\`\`\n${XSS_PAYLOAD}\n\`\`\``)).toBe(
      '<pre><code>&lt;img src=x onerror=alert(1)&gt;</code></pre>'
    )
  })

  it('常规 markdown 渲染不回归', () => {
    expect(markdownToPreviewHtml('**a & b**')).toBe(
      '<p><strong>a &amp; b</strong></p>'
    )
    expect(markdownToPreviewHtml('`<div>`')).toBe(
      '<p><code>&lt;div&gt;</code></p>'
    )
    expect(markdownToPreviewHtml('[link](https://kungal.com?a=1&b=2)')).toBe(
      '<p><a href="https://kungal.com?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">link</a></p>'
    )
    expect(markdownToPreviewHtml('~~del~~ *em* ***both***')).toBe(
      '<p><del>del</del> <em>em</em> <strong><em>both</em></strong></p>'
    )
    expect(markdownToPreviewHtml('`*a*`')).toBe('<p><code>*a*</code></p>')
  })

  it('嵌套行内语法不再被转义成字面文本', () => {
    expect(markdownToPreviewHtml('*[a](https://kungal.com)*')).toBe(
      '<p><em><a href="https://kungal.com" target="_blank" rel="noopener noreferrer">a</a></em></p>'
    )
  })
})
