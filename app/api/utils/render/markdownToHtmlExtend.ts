import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypePrism from 'rehype-prism-plus'
import remarkDirective from 'remark-directive'
import { unified } from 'unified'
import { remarkKunVideo } from './remarkKunVideo'
import { remarkKunLink } from './remarkKunLink'
import { remarkKunExternalLinks } from './remarkKunExternalLinks'
import { remarkKunWrapImage } from './remarkKunWrapImage'

export const markdownToHtmlExtend = async (markdown: string) => {
  const htmlVFile = await unified()
    .use(remarkParse)
    .use(remarkDirective)
    .use(remarkKunVideo)
    .use(remarkKunLink)
    .use(remarkRehype)
    .use(remarkKunExternalLinks)
    .use(rehypeSanitize, {
      attributes: {
        div: [
          'data-video-player',
          'data-src',
          'data-kun-link',
          'data-href',
          'data-text',
          'data-kun-img-container',
          'className'
        ],
        img: ['src', 'alt', 'title', 'class', 'loading'],
        a: [
          'data-kun-external-link',
          'data-href',
          'data-text',
          'href',
          'target',
          'rel',
          'className'
        ]
      }
    })
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(rehypePrism, { ignoreMissing: true })
    .use(remarkKunWrapImage)
    .use(rehypeStringify)
    .process(markdown)

  return String(htmlVFile)
}
