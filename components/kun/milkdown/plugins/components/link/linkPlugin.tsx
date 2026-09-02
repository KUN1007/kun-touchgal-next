'use client'

import { $command, $inputRule, $node, $remark } from '@milkdown/utils'
import { Node } from '@milkdown/prose/model'
import { InputRule } from '@milkdown/prose/inputrules'
import {
  useNodeViewContext,
  type ReactNodeViewUserOptions
} from '@prosemirror-adapter/react'
import directive from 'remark-directive'
import { KunLink } from './KunLink'

interface InsertKunLinkCommandPayload {
  href: string
  text: string
}

export const kunImageRemarkDirective = $remark('kun-link', () => directive)

// leaf 节点, 理由同 videoPlugin.tsx 的 videoNode
export const kunLinkNode = $node('kun-link', () => ({
  group: 'block',
  selectable: true,
  draggable: true,
  marks: '',
  attrs: {
    href: { default: '' },
    text: { default: '' }
  },
  parseDOM: [
    {
      tag: 'div[data-kun-link]',
      getAttrs: (dom) => ({
        href: dom.getAttribute('data-href'),
        text: dom.getAttribute('data-text')
      })
    }
  ],
  // 只服务剪贴板 / 拖拽的 HTML 序列化, 编辑器内的实际渲染走下方 nodeView
  toDOM: (node: Node) => [
    'div',
    {
      'data-kun-link': '',
      'data-href': node.attrs.href,
      'data-text': node.attrs.text
    }
  ],
  parseMarkdown: {
    match: (node) => node.name === 'kun-link',
    runner: (state, node, type) => {
      const { href, text } = node.attributes as InsertKunLinkCommandPayload
      state.addNode(type, {
        href,
        text
      })
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'kun-link',
    runner: (state, node) => {
      state.addNode('leafDirective', undefined, node.attrs.text, {
        name: 'kun-link',
        attributes: node.attrs
      })
    }
  }
}))

const KunLinkView = () => {
  const { node } = useNodeViewContext()
  return <KunLink href={node.attrs.href} text={node.attrs.text} />
}

// 生命周期交给 @prosemirror-adapter, 理由同 videoPlugin.tsx 的 kunVideoNodeViewOptions
export const kunLinkNodeViewOptions: ReactNodeViewUserOptions = {
  component: KunLinkView
}

export const insertKunLinkCommand = $command(
  'InsertKunLink',
  (ctx) =>
    (payload: InsertKunLinkCommandPayload = { href: '', text: '' }) =>
    (state, dispatch) => {
      if (!dispatch) return true

      const { href = '', text = '' } = payload
      const node = kunLinkNode.type(ctx).create({ href, text })

      if (!node) return true

      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
      return true
    }
)

export const kunLinkInputRule = $inputRule(
  (ctx) =>
    new InputRule(
      // Matches format: [[text]](url)
      /\[\[(?<text>[^\]]+)\]\]\((?<href>[^)]+)\)/,
      (state, match, start, end) => {
        const [matched, text = '', href = ''] = match
        const { tr } = state

        if (matched) {
          return tr.replaceWith(
            start - 1,
            end,
            kunLinkNode.type(ctx).create({ href, text })
          )
        }
        return null
      }
    )
)
