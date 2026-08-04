const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const INLINE_PATTERN =
  /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|~~(.+?)~~/

// 逐段消费而非链式 replace: 生成的标签不再参与后续匹配, 否则用户文本能借上一条规则
// 生成的引号截断属性 (如 ![a](q[w](x onerror=alert 1 )X) 会把 onerror 注入 img)
const renderInlineMarkdown = (text: string): string => {
  let rest = text
  let html = ''

  while (rest) {
    const match = INLINE_PATTERN.exec(rest)
    if (!match) {
      html += escapeHtml(rest)
      break
    }

    const groups: (string | undefined)[] = match
    const [, alt, src, linkText, href, code, both, bold, italic, strike] =
      groups

    html += escapeHtml(rest.slice(0, match.index))

    if (src !== undefined) {
      html += `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt ?? '')}" class="max-w-full rounded-lg border border-default-200 my-2" />`
    } else if (href !== undefined) {
      html += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText ?? '')}</a>`
    } else if (code !== undefined) {
      html += `<code>${escapeHtml(code)}</code>`
    } else if (both !== undefined) {
      html += `<strong><em>${renderInlineMarkdown(both)}</em></strong>`
    } else if (bold !== undefined) {
      html += `<strong>${renderInlineMarkdown(bold)}</strong>`
    } else if (italic !== undefined) {
      html += `<em>${renderInlineMarkdown(italic)}</em>`
    } else if (strike !== undefined) {
      html += `<del>${renderInlineMarkdown(strike)}</del>`
    }

    rest = rest.slice(match.index + match[0].length)
  }

  return html
}

export const markdownToPreviewHtml = (markdown: string): string => {
  if (!markdown.trim()) {
    return '<p class="text-default-400 italic">暂无内容</p>'
  }

  const lines = markdown.split('\n')
  const result: string[] = []
  let inCodeBlock = false
  let codeContent = ''
  let codeLanguage = ''
  let inList: 'ul' | 'ol' | null = null

  const flushList = () => {
    if (inList) {
      result.push(`</${inList}>`)
      inList = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        result.push(
          `<pre><code>${escapeHtml(codeContent.trimEnd())}</code></pre>`
        )
        codeContent = ''
        codeLanguage = ''
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
        codeLanguage = line.slice(3).trim()
      }
      continue
    }

    if (inCodeBlock) {
      codeContent += line + '\n'
      continue
    }

    if (line.trim() === '') {
      flushList()
      continue
    }

    if (/^>(\s|$)/.test(line)) {
      flushList()
      const quoteParagraphs: string[] = []
      let buffer: string[] = []
      const flushBuffer = () => {
        if (buffer.length) {
          quoteParagraphs.push(
            `<p>${buffer.map(renderInlineMarkdown).join('<br>')}</p>`
          )
          buffer = []
        }
      }
      while (i < lines.length && /^>(\s|$)/.test(lines[i])) {
        const quoteLine = lines[i].replace(/^>\s?/, '')
        if (quoteLine.trim() === '') {
          flushBuffer()
        } else {
          buffer.push(quoteLine)
        }
        i++
      }
      flushBuffer()
      i--
      if (quoteParagraphs.length) {
        result.push(`<blockquote>${quoteParagraphs.join('')}</blockquote>`)
      }
      continue
    }

    if (/^---/.test(line)) {
      flushList()
      result.push('<hr>')
      continue
    }

    const ulMatch = line.match(/^(\s*)[-*] (.+)/)
    if (ulMatch) {
      if (inList !== 'ul') {
        flushList()
        result.push('<ul>')
        inList = 'ul'
      }
      result.push(`<li>${renderInlineMarkdown(ulMatch[2])}</li>`)
      continue
    }

    const olMatch = line.match(/^(\s*)\d+\. (.+)/)
    if (olMatch) {
      if (inList !== 'ol') {
        flushList()
        result.push('<ol>')
        inList = 'ol'
      }
      result.push(`<li>${renderInlineMarkdown(olMatch[2])}</li>`)
      continue
    }

    flushList()

    if (/^###### (.+)/.test(line)) {
      const content = line.replace(/^###### /, '')
      result.push(`<h6>${renderInlineMarkdown(content)}</h6>`)
      continue
    }

    if (/^##### (.+)/.test(line)) {
      const content = line.replace(/^##### /, '')
      result.push(`<h5>${renderInlineMarkdown(content)}</h5>`)
      continue
    }

    if (/^#### (.+)/.test(line)) {
      const content = line.replace(/^#### /, '')
      result.push(`<h4>${renderInlineMarkdown(content)}</h4>`)
      continue
    }

    if (/^### (.+)/.test(line)) {
      const content = line.replace(/^### /, '')
      result.push(`<h3>${renderInlineMarkdown(content)}</h3>`)
      continue
    }

    if (/^## (.+)/.test(line)) {
      const content = line.replace(/^## /, '')
      result.push(`<h2>${renderInlineMarkdown(content)}</h2>`)
      continue
    }

    if (/^# (.+)/.test(line)) {
      const content = line.replace(/^# /, '')
      result.push(`<h1>${renderInlineMarkdown(content)}</h1>`)
      continue
    }

    const tableMatch = line.match(/^\|(.+)\|$/)
    if (tableMatch) {
      const cells = tableMatch[1]
        .split('|')
        .map((c) => c.trim())
        .filter(Boolean)
      const nextLine = lines[i + 1]
      const isHeader = nextLine && /^\|[\s\-:]+\|$/.test(nextLine)

      if (isHeader) {
        result.push(
          '<table><thead><tr>' +
            cells.map((c) => `<th>${renderInlineMarkdown(c)}</th>`).join('') +
            '</tr></thead><tbody>'
        )
        i++
        continue
      }

      if (result.length && result[result.length - 1] === '<tbody>') {
        result.push(
          '<tr>' +
            cells.map((c) => `<td>${renderInlineMarkdown(c)}</td>`).join('') +
            '</tr>'
        )
        continue
      }
    }

    if (result.length && result[result.length - 1] === '<tbody>') {
      result.push('</tbody></table>')
    }

    result.push(`<p>${renderInlineMarkdown(line)}</p>`)
  }

  if (inCodeBlock) {
    result.push(`<pre><code>${escapeHtml(codeContent.trimEnd())}</code></pre>`)
  }

  if (result.length && result[result.length - 1] === '<tbody>') {
    result.push('</tbody></table>')
  }

  flushList()

  return result.join('\n')
}
