'use client'

import { $command, $inputRule, $node, $remark } from '@milkdown/utils'
import { Node } from '@milkdown/prose/model'
import { InputRule } from '@milkdown/prose/inputrules'
import {
  useNodeViewContext,
  type ReactNodeViewUserOptions
} from '@prosemirror-adapter/react'
import dynamic from 'next/dynamic'
import directive from 'remark-directive'

export const kunVideoRemarkDirective = $remark('kun-video', () => directive)

const KunPlyr = dynamic(() => import('./Plyr').then((mod) => mod.KunPlyr), {
  ssr: false
})

// leaf 节点: 从不带子节点。之前声明的 block+ 只会让 transformer 的 createAndFill
// 塞进一个隐形空段落, 也会让 adapter 的 nodeView 多挂一个永不附着的 contentDOM
export const videoNode = $node('kun-video', () => ({
  group: 'block',
  selectable: true,
  draggable: true,
  atom: true,
  isolating: true,
  defining: true,
  marks: '',
  attrs: {
    src: { default: '' }
  },
  parseDOM: [
    {
      tag: 'div[data-video-player]',
      getAttrs: (dom) => ({
        src: dom.getAttribute('data-src')
      })
    }
  ],
  // 只服务剪贴板 / 拖拽的 HTML 序列化, 编辑器内的实际渲染走下方 nodeView
  toDOM: (node: Node) => [
    'div',
    { 'data-video-player': '', 'data-src': node.attrs.src }
  ],
  parseMarkdown: {
    match: (node) => node.name === 'kun-video',
    runner: (state, node, type) => {
      state.addNode(type, { src: (node.attributes as { src: string }).src })
    }
  },
  toMarkdown: {
    match: (node) => node.type.name === 'kun-video',
    runner: (state, node) => {
      state.addNode('leafDirective', undefined, undefined, {
        name: 'kun-video',
        attributes: node.attrs
      })
    }
  }
}))

const KunVideoView = () => {
  const { node } = useNodeViewContext()
  return <KunPlyr src={node.attrs.src} />
}

// React 生命周期交给 @prosemirror-adapter: 节点销毁 / 编辑器卸载时摘掉 portal,
// KunPlyr 的 effect cleanup 才会跑到 player.destroy()。旧写法在 toDOM 里 createRoot
// 且从不 unmount, 每个 Plyr 实例向 document 注册的监听会把整棵 fiber 树钉住
export const kunVideoNodeViewOptions: ReactNodeViewUserOptions = {
  component: KunVideoView,
  as: () => {
    const dom = document.createElement('div')
    dom.className = 'w-full my-4 overflow-hidden shadow-lg rounded-xl'
    return dom
  }
}

interface InsertKunVideoCommandPayload {
  src: string
}

export const insertKunVideoCommand = $command(
  'InsertKunVideo',
  (ctx) =>
    (payload: InsertKunVideoCommandPayload = { src: '' }) =>
    (state, dispatch) => {
      if (!dispatch) {
        return true
      }
      const { src = '' } = payload
      const node = videoNode.type(ctx).create({ src })
      if (!node) {
        return true
      }
      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
      return true
    }
)

export const videoInputRule = $inputRule(
  (ctx) =>
    new InputRule(
      // Matches format: {{kun-video="video url"}}
      // eg: {{kun-video="https://cloud.touchgaloss.com/2023/05/f15179024920231109233759.mp4"}}
      /{{kun-video="(?<src>[^"]+)?"?\}}/,
      (state, match, start, end) => {
        const [matched, src = ''] = match
        const { tr } = state
        if (matched) {
          return tr.replaceWith(
            start - 1,
            end,
            videoNode.type(ctx).create({ src })
          )
        }
        return null
      }
    )
)
