import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypePrism from 'rehype-prism-plus'
import remarkDirective from 'remark-directive'
import { unified } from 'unified'
import { remarkKunExternalLinks } from './remarkKunExternalLinks'
import { renderMarkdownHtmlWithCache } from './markdownHtmlCache'
import { markdownSanitizeSchema } from './sanitizeSchema'
import type { Plugin } from 'unified'
import type { Node } from 'unist'

const isDirectiveNode = (type: string) =>
  type === 'containerDirective' ||
  type === 'leafDirective' ||
  type === 'textDirective'

const remarkDropDirectives: Plugin<[], Node> = () => {
  const walk = (node: any) => {
    if (!node || !Array.isArray(node.children)) {
      return
    }
    node.children = node.children.filter(
      (child: any) => !isDirectiveNode(child.type)
    )
    node.children.forEach(walk)
  }
  return (tree) => walk(tree)
}

const markdownCommentProcessor = unified()
  .use(remarkParse)
  .use(remarkDirective)
  .use(remarkDropDirectives)
  .use(remarkRehype)
  .use(remarkKunExternalLinks)
  .use(rehypeSanitize, markdownSanitizeSchema)
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .use(rehypePrism, { ignoreMissing: true })
  .use(rehypeStringify)
  .freeze()

export const markdownToHtmlComment = async (markdown: string) => {
  return renderMarkdownHtmlWithCache('comment', markdown, async () => {
    const htmlVFile = await markdownCommentProcessor.process(markdown)

    return String(htmlVFile)
  })
}
