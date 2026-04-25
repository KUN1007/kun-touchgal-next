import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypePrism from 'rehype-prism-plus'
import { unified } from 'unified'
import { remarkKunExternalLinks } from './remarkKunExternalLinks'
import { renderMarkdownHtmlWithCache } from './markdownHtmlCache'
import { markdownSanitizeSchema } from './sanitizeSchema'

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(remarkKunExternalLinks)
  .use(rehypeSanitize, markdownSanitizeSchema)
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .use(rehypePrism, { ignoreMissing: true })
  .use(rehypeStringify)
  .freeze()

export const markdownToHtml = async (markdown: string) => {
  return renderMarkdownHtmlWithCache('standard', markdown, async () => {
    const htmlVFile = await markdownProcessor.process(markdown)

    return String(htmlVFile)
  })
}
