import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Node } from 'unist'

export const rehypeKunImageLoading: Plugin<[], Node> = () => {
  return (tree) => {
    visit(tree, 'element', (node: any) => {
      if (node.tagName !== 'img') {
        return
      }

      const properties = node.properties || (node.properties = {})
      properties.loading = 'lazy'
      properties.decoding = 'async'
    })
  }
}
