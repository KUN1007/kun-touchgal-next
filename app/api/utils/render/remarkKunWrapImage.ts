import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import type { Node } from 'unist'

// wrap introduction screenshot images
export const remarkKunWrapImage: Plugin<[], Node> = () => {
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

      for (let j = index + 1; j < siblings.length; ) {
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

      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['data-kun-img-container'] },
        // @ts-expect-error Include a description after the "@ts-expect-error" directive
        children: collected
      }

      siblings.splice(index + 1, 0, wrapper)
    })
  }
}
