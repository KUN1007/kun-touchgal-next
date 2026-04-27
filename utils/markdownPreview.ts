const escapeHtml = (text: string): string => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const renderInlineMarkdown = (text: string): string => {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" class="max-w-full rounded-lg border border-default-200 my-2" />`
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
      return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
    })
    .replace(/`([^`]+)`/g, (_, code) => {
      return `<code>${escapeHtml(code)}</code>`
    })
    .replace(
      /\*\*\*(.+?)\*\*\*/g,
      (_, t) => `<strong><em>${escapeHtml(t)}</em></strong>`
    )
    .replace(/\*\*(.+?)\*\*/g, (_, t) => `<strong>${escapeHtml(t)}</strong>`)
    .replace(/\*(.+?)\*/g, (_, t) => `<em>${escapeHtml(t)}</em>`)
    .replace(/~~(.+?)~~/g, (_, t) => `<del>${escapeHtml(t)}</del>`)
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

    const videoMatch = line.match(/^::kun-video\{src="([^"]+)"\}$/)
    if (videoMatch) {
      flushList()
      const src = escapeHtml(videoMatch[1])
      result.push(
        `<div class="bg-default-100 border-default-200 my-4 flex items-center gap-3 rounded-xl border p-4 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-500 shrink-0"><polygon points="5 3 19 12 5 21 5 3"/></svg><span class="text-default-600 text-sm">视频: ${src}</span></div>`
      )
      continue
    }

    if (/^> /.test(line)) {
      flushList()
      const quoteContent = line.replace(/^> /, '')
      const renderedQuote = renderInlineMarkdown(quoteContent)
      result.push(`<blockquote><p>${renderedQuote}</p></blockquote>`)
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
